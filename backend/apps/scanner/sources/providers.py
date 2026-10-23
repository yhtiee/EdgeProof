"""
One function per provider. Each returns a list of Rows; failures raise
SourceError so ingestion can record the source's health and carry on.
"""

import csv
import io
import time
import urllib.parse
import zipfile
from datetime import date, timedelta

from django.conf import settings
from django.utils import timezone

from ..reference import ALL_PAIRS, CURRENCIES, METALS
from . import Row, SourceError, get, get_json, get_text, number, parse_period

COT_CODES = {code: cot for code, _, _, cot, _ in CURRENCIES + METALS}
BIS_AREAS = {"US": "USD", "XM": "EUR", "GB": "GBP", "JP": "JPY", "AU": "AUD", "NZ": "NZD", "CA": "CAD", "CH": "CHF"}
OECD_AREAS = {"USA": "USD", "EA20": "EUR", "GBR": "GBP", "JPN": "JPY", "AUS": "AUD", "NZL": "NZD", "CAN": "CAD", "CHE": "CHF"}


# --- CFTC: Commitments of Traders, legacy futures-only report ------------------------------


def cftc(start: date) -> list[Row]:
    """Net non-commercial position per currency future. History from yearly zips, this week from deafut.txt."""
    by_code = {v: k for k, v in COT_CODES.items()}
    rows: dict[tuple[str, date], Row] = {}

    def add(code, when, long_, short_, oi):
        ccy = by_code.get(code.strip())
        if ccy and when >= start:
            rows[(ccy, when)] = Row("cot", ccy, when, float(long_ - short_), "W", "net_noncommercial",
                                    {"long": long_, "short": short_, "open_interest": oi})

    for year in range(start.year, timezone.localdate().year + 1):
        try:
            z = zipfile.ZipFile(io.BytesIO(get(f"https://www.cftc.gov/files/dea/history/deacot{year}.zip", timeout=120)))
        except SourceError:
            continue  # the current year's file can lag; deafut.txt covers the latest week
        for r in csv.DictReader(io.StringIO(z.read(z.namelist()[0]).decode("latin-1"))):
            try:
                add(r["CFTC Contract Market Code"], date.fromisoformat(r["As of Date in Form YYYY-MM-DD"].strip()),
                    int(r["Noncommercial Positions-Long (All)"]), int(r["Noncommercial Positions-Short (All)"]), int(r["Open Interest (All)"]))
            except (KeyError, ValueError):
                continue
    for r in csv.reader(io.StringIO(get_text("https://www.cftc.gov/dea/newcot/deafut.txt"))):
        try:
            add(r[3], date.fromisoformat(r[2].strip()), int(r[8]), int(r[9]), int(r[7]))
        except (IndexError, ValueError):
            continue
    if not rows:
        raise SourceError("CFTC returned no currency futures rows")
    return list(rows.values())


# --- BIS: central bank policy rates (daily) ---------------------------------------------------


def bis_rates(start: date) -> list[Row]:
    """Each central bank's rate changes, plus its latest value (the scoring needs when it moved, not every flat day)."""
    areas = "+".join(BIS_AREAS)
    text = get_text(f"https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/D.{areas}?startPeriod={start.isoformat()}&format=csvfilewithlabels", timeout=120)
    by_ccy: dict[str, list[tuple[date, float]]] = {}
    for r in csv.DictReader(io.StringIO(text)):
        value = number(r.get("OBS_VALUE"))
        if value is not None and r.get("REF_AREA") in BIS_AREAS:
            by_ccy.setdefault(BIS_AREAS[r["REF_AREA"]], []).append((date.fromisoformat(r["TIME_PERIOD"]), value))
    out = []
    for ccy, points in by_ccy.items():
        points.sort()
        previous = None
        for when, value in points:
            if value != previous:
                out.append(Row("rates", ccy, when, value, "D", "policy_rate"))
                previous = value
        last_day, last_value = points[-1]
        if out[-1].period != last_day:
            out.append(Row("rates", ccy, last_day, last_value, "D", "policy_rate"))
    if not out:
        raise SourceError("BIS returned no policy rates")
    return out


# --- OECD Data API (SDMX) --------------------------------------------------------------------


def _oecd(flow: str, key: str, start: date) -> list[dict]:
    url = f"https://sdmx.oecd.org/public/rest/data/{flow}/{key}?startPeriod={start.year}-{start.month:02d}&dimensionAtObservation=AllDimensions&format=csvfilewithlabels"
    rows = list(csv.DictReader(io.StringIO(get_text(url, timeout=120))))
    time.sleep(2)  # OECD rate-limits bursts
    return rows


def _oecd_rows(rows: list[dict], factor: str, series: str) -> list[Row]:
    out = []
    for r in rows:
        ccy = OECD_AREAS.get(r.get("REF_AREA", ""))
        value = number(r.get("OBS_VALUE"))
        if not ccy or value is None:
            continue
        period, freq = parse_period(r["TIME_PERIOD"])
        out.append(Row(factor, ccy, period, value, freq, series))
    return out


def oecd_macro(start: date) -> list[Row]:
    out = []
    # CPI y/y: monthly for US, GB, CA; quarterly for AU and NZ (they publish quarterly).
    out += _oecd_rows(_oecd("OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0", "USA+GBR+CAN.M.N.CPI.PA._T.N.GY", start), "inflation", "cpi_yoy")
    out += _oecd_rows(_oecd("OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0", "AUS+NZL.Q.N.CPI.PA._T.N.GY", start), "inflation", "cpi_yoy")
    # Unemployment: monthly where published, quarterly for NZ and CH.
    out += _oecd_rows(_oecd("OECD.SDD.TPS,DSD_LFS@DF_IALFS_UNE_M,1.0", "USA+GBR+JPN+AUS+CAN..._Z.Y._T.Y_GE15..M", start), "labour", "unemployment")
    out += _oecd_rows(_oecd("OECD.SDD.TPS,DSD_LFS@DF_IALFS_UNE_M,1.0", "NZL+CHE..._Z.Y._T.Y_GE15..Q", start), "labour", "unemployment")
    # Business confidence (amplitude adjusted, 100 = long-run average), all 8.
    out += _oecd_rows(_oecd("OECD.SDD.STES,DSD_STES@DF_CLI,4.1", "USA+EA20+GBR+JPN+AUS+NZL+CAN+CHE.M.BCICP...AA...H", start), "business", "bci")
    # Real GDP growth q/q (euro area comes from Eurostat).
    out += _oecd_rows(_oecd("OECD.SDD.NAD,DSD_NAMAIN1@DF_QNA_EXPENDITURE_GROWTH_OECD,1.1", "Q..USA+GBR+JPN+AUS+NZL+CAN+CHE.S1..B1GQ......G1.", start), "growth", "gdp_qoq")
    # 3-month interbank rates: the scoreboard's market proxy for the next quarter's policy rate (no UK series).
    out += _oecd_rows(_oecd("OECD.SDD.STES,DSD_STES@DF_FINMARK,4.0", "USA+EA20+GBR+JPN+AUS+NZL+CAN+CHE.M.IR3TIB.PA.....", start), "rate3m", "ir3tib")
    if not out:
        raise SourceError("OECD returned no rows")
    return out


# --- Eurostat (euro area GDP and unemployment) ------------------------------------------------


def _eurostat(dataset: str, query: str, start: date) -> list[tuple[str, float]]:
    url = f"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{dataset}?{query}&sinceTimePeriod={start.year}-{start.month:02d}"
    if dataset.startswith("namq"):
        url = url.replace(f"{start.year}-{start.month:02d}", f"{start.year}-Q{(start.month - 1) // 3 + 1}")
    d = get_json(url, timeout=120)
    index = d["dimension"]["time"]["category"]["index"]
    values = d.get("value", {})
    return [(t, float(values[str(i)])) for t, i in index.items() if str(i) in values]


def eurostat_euro_area(start: date) -> list[Row]:
    out = []
    best: dict[str, Row] = {}
    # The euro area's code changes as members join (EA20 → EA21 in 2026); merge, latest code wins per period.
    for geo in ("EA20", "EA21"):
        try:
            for t, v in _eurostat("une_rt_m", f"geo={geo}&s_adj=SA&age=TOTAL&sex=T&unit=PC_ACT", start):
                period, freq = parse_period(t)
                best[f"u{t}"] = Row("labour", "EUR", period, v, freq, "unemployment", {"geo": geo})
        except SourceError:
            pass
    for geo in ("EA20", "EA"):
        try:
            for t, v in _eurostat("namq_10_gdp", f"geo={geo}&na_item=B1GQ&unit=CLV_PCH_PRE&s_adj=SCA", start):
                period, freq = parse_period(t)
                best[f"g{t}"] = Row("growth", "EUR", period, v, freq, "gdp_qoq", {"geo": geo})
        except SourceError:
            pass
    out = list(best.values())
    if not out:
        raise SourceError("Eurostat returned no euro area rows")
    return out


# --- FRED (euro area HICP index → y/y) ------------------------------------------------------


def fred_euro_cpi(start: date) -> list[Row]:
    key = settings.SCANNER["fred_key"]
    if not key:
        raise SourceError("FRED_API_KEY is not set")
    begin = date(start.year - 1, start.month, 1)
    d = get_json(f"https://api.stlouisfed.org/fred/series/observations?series_id=CP0000EZ19M086NEST&observation_start={begin.isoformat()}&api_key={key}&file_type=json")
    points = {date.fromisoformat(o["date"]): number(o["value"]) for o in d["observations"] if number(o["value"]) is not None}
    out = []
    for when, v in sorted(points.items()):
        prev = points.get(date(when.year - 1, when.month, 1))
        if prev and when >= start:
            out.append(Row("inflation", "EUR", when, round((v / prev - 1) * 100, 3), "M", "cpi_yoy", {"from": "HICP index"}))
    return out


def _fred(path: str, **query) -> dict:
    key = settings.SCANNER["fred_key"]
    if not key:
        raise SourceError("FRED_API_KEY is not set")
    return get_json(f"https://api.stlouisfed.org/fred/{path}?" + urllib.parse.urlencode({**query, "api_key": key, "file_type": "json"}))


def fred_us(start: date) -> list[Row]:
    """The US 2-year Treasury yield, daily (the scoreboard's rates rule for gold)."""
    d = _fred("series/observations", series_id="DGS2", observation_start=max(start, timezone.localdate() - timedelta(days=120)).isoformat())
    out = [Row("yield2y", "USD", date.fromisoformat(o["date"]), number(o["value"]), "D", "dgs2") for o in d["observations"] if number(o["value"]) is not None]
    if not out:
        raise SourceError("FRED returned no 2-year yields")
    return out


def fred_vintage_dates(series: str, since: date) -> list[date]:
    d = _fred("series/vintagedates", series_id=series, realtime_start=since.isoformat())
    return [date.fromisoformat(v) for v in d.get("vintage_dates", [])]


def fred_vintage(series: str, day: date, since: date) -> list[tuple[date, float]]:
    """The series as published on `day` (FRED's real-time vintage), from `since`."""
    d = _fred("series/observations", series_id=series, realtime_start=day.isoformat(), realtime_end=day.isoformat(), observation_start=since.isoformat())
    return [(date.fromisoformat(o["date"]), number(o["value"])) for o in d["observations"] if number(o["value"]) is not None]


def fred_first_releases(series: str, since: date) -> list[tuple[date, float, date]]:
    """Each observation's first published value and the day it was published: (period, value, released)."""
    d = _fred("series/observations", series_id=series, output_type=4, realtime_start=since.isoformat(), realtime_end="9999-12-31",
              observation_start=(since - timedelta(days=62)).isoformat())
    return [(date.fromisoformat(o["date"]), number(o["value"]), date.fromisoformat(o["realtime_start"]))
            for o in d["observations"] if number(o["value"]) is not None]


def eurostat_survey(indicator: str, start: date) -> list[tuple[date, float]]:
    """European Commission business survey balances for the euro area (EA21 from 2026, EA20 before)."""
    best: dict[str, float] = {}
    for geo in ("EA20", "EA21"):
        try:
            for t, v in _eurostat("ei_bssi_m_r2", f"geo={geo}&indic={indicator}&s_adj=SA", start):
                best[t] = v  # the later code wins per period
        except (SourceError, KeyError):
            continue
    return sorted((parse_period(t)[0], v) for t, v in best.items())


# --- SNB (Swiss CPI y/y) ------------------------------------------------------------------


def snb_cpi(start: date) -> list[Row]:
    text = get_text(f"https://data.snb.ch/api/cube/plkopr/data/csv/en?fromDate={start.year}-{start.month:02d}")
    out = []
    for line in text.splitlines():
        parts = [p.strip('"') for p in line.split(";")]
        if len(parts) == 3 and parts[1] == "VVP" and number(parts[2]) is not None:
            try:
                period, freq = parse_period(parts[0])
                out.append(Row("inflation", "CHF", period, number(parts[2]), freq, "cpi_yoy"))
            except ValueError:
                continue
    if not out:
        raise SourceError("SNB returned no CPI rows")
    return out


# --- DBnomics (IMF CPI for Japan; the freshest free keyless source found) ----------------------


def dbnomics_japan_cpi(start: date) -> list[Row]:
    d = get_json("https://api.db.nomics.world/v22/series/IMF/CPI/M.JP.PCPI_PC_CP_A_PT?observations=1")
    doc = d["series"]["docs"][0]
    out = []
    for period, value in zip(doc["period"], doc["value"]):
        if number(value) is None:
            continue
        p, freq = parse_period(period)
        if p >= start:
            out.append(Row("inflation", "JPY", p, number(value), freq, "cpi_yoy", {"from": "IMF via DBnomics"}))
    return out


# --- Twelve Data (daily closes) --------------------------------------------------------------


def twelvedata_prices(days: int) -> list[Row]:
    key = settings.SCANNER["twelvedata_key"]
    if not key:
        raise SourceError("TWELVEDATA_API_KEY is not set")
    out = []
    symbols = [f"{p[:3]}/{p[3:]}" for p in ALL_PAIRS]
    for i in range(0, len(symbols), 8):  # free tier: 8 credits a minute
        batch = symbols[i:i + 8]
        d = get_json("https://api.twelvedata.com/time_series?" + urllib.parse.urlencode(
            {"symbol": ",".join(batch), "interval": "1day", "outputsize": days, "apikey": key, "timezone": "UTC"}), timeout=120)
        if len(batch) == 1:
            d = {batch[0]: d}
        for sym, payload in d.items():
            if payload.get("status") != "ok":
                raise SourceError(f"Twelve Data {sym}: {payload.get('message', 'error')}")
            for v in payload.get("values", []):
                out.append(Row("trend", sym.replace("/", ""), date.fromisoformat(v["datetime"][:10]), float(v["close"]), "D", "close"))
        if i + 8 < len(symbols):
            time.sleep(62)
    return out


def twelvedata_monthly() -> list[Row]:
    """Monthly open and close for every pair and gold, about 16 years (the scoreboard's seasonality)."""
    key = settings.SCANNER["twelvedata_key"]
    if not key:
        raise SourceError("TWELVEDATA_API_KEY is not set")
    out = []
    symbols = [f"{p[:3]}/{p[3:]}" for p in ALL_PAIRS]
    time.sleep(62)  # runs straight after the daily fetch, which spends this minute's credits
    for i in range(0, len(symbols), 8):  # free tier: 8 credits a minute
        batch = symbols[i:i + 8]
        d = get_json("https://api.twelvedata.com/time_series?" + urllib.parse.urlencode(
            {"symbol": ",".join(batch), "interval": "1month", "outputsize": 200, "apikey": key, "timezone": "UTC"}), timeout=120)
        if len(batch) == 1:
            d = {batch[0]: d}
        for sym, payload in d.items():
            if payload.get("status") != "ok":
                raise SourceError(f"Twelve Data {sym}: {payload.get('message', 'error')}")
            for v in payload.get("values", []):
                out.append(Row("monthly", sym.replace("/", ""), date.fromisoformat(v["datetime"][:10]).replace(day=1), float(v["close"]), "M",
                               "close", {"open": float(v["open"])}))
        if i + 8 < len(symbols):
            time.sleep(62)
    return out


# --- Myfxbook (retail sentiment) ------------------------------------------------------------


def myfxbook_sentiment() -> list[Row]:
    email, password = settings.SCANNER["myfxbook_email"], settings.SCANNER["myfxbook_password"]
    if not email or not password:
        raise SourceError("MYFXBOOK_EMAIL / MYFXBOOK_PASSWORD are not set")
    login = get_json("https://www.myfxbook.com/api/login.json?" + urllib.parse.urlencode({"email": email, "password": password}))
    if login.get("error"):
        raise SourceError(f"Myfxbook login: {login.get('message')}")
    session = login["session"]
    try:
        outlook = get_json("https://www.myfxbook.com/api/get-community-outlook.json?" + urllib.parse.urlencode({"session": session}))
    finally:
        try:
            get("https://www.myfxbook.com/api/logout.json?" + urllib.parse.urlencode({"session": session}))
        except SourceError:
            pass
    if outlook.get("error"):
        raise SourceError(f"Myfxbook outlook: {outlook.get('message')}")
    today = timezone.localdate()
    out = []
    for s in outlook.get("symbols", []):
        if s.get("name") in ALL_PAIRS:
            sample = int(s.get("longPositions", 0)) + int(s.get("shortPositions", 0))
            out.append(Row("retail", s["name"], today, float(s["longPercentage"]), "D", "long_pct", {"sample": sample, "short_pct": s.get("shortPercentage")}))
    if not out:
        raise SourceError("Myfxbook returned no pairs")
    return out


SOURCES = {
    # name: (function, base url, takes a start date)
    "cftc": (cftc, "https://www.cftc.gov", True),
    "bis": (bis_rates, "https://stats.bis.org", True),
    "oecd": (oecd_macro, "https://sdmx.oecd.org", True),
    "eurostat": (eurostat_euro_area, "https://ec.europa.eu/eurostat", True),
    "fred": (fred_euro_cpi, "https://fred.stlouisfed.org", True),
    "snb": (snb_cpi, "https://data.snb.ch", True),
    "dbnomics": (dbnomics_japan_cpi, "https://db.nomics.world", True),
    "fred_us": (fred_us, "https://fred.stlouisfed.org", True),
    "twelvedata": (twelvedata_prices, "https://twelvedata.com", False),
    "twelvedata_monthly": (twelvedata_monthly, "https://twelvedata.com", False),  # skipped while this month's closes are in
    "myfxbook": (myfxbook_sentiment, "https://www.myfxbook.com", False),
    "news": (None, "https://www.federalreserve.gov", False),  # central bank feeds; stored by ingest.run_news
    "calendar": (None, "https://www.forexfactory.com/calendar", False),  # stored by ingest.run_calendar
    "releases": (None, "https://fred.stlouisfed.org", False),  # scoreboard actuals; stored by releases.resolve_all
}
# Which sources each scheduled job runs (spec "Scheduled jobs").
JOBS = {
    "fetch_cot": ["cftc"],
    "fetch_macro": ["bis", "oecd", "eurostat", "fred", "fred_us", "snb", "dbnomics", "releases"],
    "fetch_prices": ["twelvedata", "twelvedata_monthly"],
    "fetch_sentiment": ["myfxbook"],
    "fetch_news": ["news", "calendar", "releases"],
}
