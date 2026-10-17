"""
Scanner reference data and default configuration (spec "Coverage" and
"Scoring methodology"; analyst notes in docs/scanner/fundamental-bias-scanner.md §3).
Weights and thresholds are starting values; FactorConfig rows hold the live,
versioned copy so they can be tuned without code changes.
"""

CURRENCIES = [
    # code, name, central bank, CFTC contract code, inflation target (midpoint of any range)
    ("USD", "US dollar", "Federal Reserve", "098662", 2.0),
    ("EUR", "Euro", "European Central Bank", "099741", 2.0),
    ("GBP", "British pound", "Bank of England", "096742", 2.0),
    ("JPY", "Japanese yen", "Bank of Japan", "097741", 2.0),
    ("AUD", "Australian dollar", "Reserve Bank of Australia", "232741", 2.5),
    ("NZD", "New Zealand dollar", "Reserve Bank of New Zealand", "112741", 2.0),
    ("CAD", "Canadian dollar", "Bank of Canada", "090741", 2.0),
    ("CHF", "Swiss franc", "Swiss National Bank", "092741", 1.0),
]
# Market convention order: the earlier currency is the base (EURUSD, GBPJPY, AUDNZD...).
ORDER = ["EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "JPY"]
PAIRS = [a + b for i, a in enumerate(ORDER) for b in ORDER[i + 1:]]

FACTORS_CURRENCY = ["cot", "rates", "inflation", "growth", "labour", "business"]
FACTORS_PAIR = ["trend", "retail"]

# factor: (weight, refresh window in days, thresholds)
# Windows are measured from the END of the data period (a September CPI is
# 0 days old on 30 Sep), sized to the publication lags observed on 17 Oct 2026:
# OECD monthly data arrives 15–60 days after the month, GDP ~45–60 days after the quarter.
DEFAULT_CONFIG = {
    "cot": (1.5, 10, {"percentiles": [20, 40, 60, 80], "lookback_weeks": 52}),
    "rates": (1.5, 14, {"recent_days": 183, "cycle_days": 730, "min_move": 0.05}),
    "inflation": (1.0, 75, {"band": 0.5, "lookback_months": 3}),
    "growth": (1.0, 150, {"cuts": [-0.2, 0.0, 0.2, 0.5]}),
    "labour": (1.0, 75, {"cuts": [0.1, 0.3]}),
    "business": (1.0, 75, {"neutral_low": 99.8, "neutral_high": 100.2}),
    "trend": (0.15, 5, {"mas": [20, 50, 200], "slope_lag": 10}),
    "retail": (0.15, 3, {"long_cuts": [25, 40, 60, 75], "small_sample": 500}),
}
# Quarterly series get a quarter's worth of window (AUD/NZD CPI, NZD/CHF unemployment).
QUARTERLY_WINDOW = 150
CONFIG_VERSION = 1

LABELS = [(6, "very_bullish"), (2, "bullish"), (-1.99, "neutral"), (-5.99, "bearish")]
LABEL_TEXT = {
    "very_bullish": "Very Bullish", "bullish": "Bullish", "neutral": "Neutral",
    "bearish": "Bearish", "very_bearish": "Very Bearish", "insufficient": "Insufficient data",
}

FACTOR_TEXT = {
    "cot": ("Speculator positioning (COT)", "How large speculators are positioned in this currency's futures, ranked against the last 52 weeks. Heavy buying ranks high."),
    "rates": ("Interest rates", "The central bank's policy rate and the direction of its last change. Rising rates tend to support a currency."),
    "inflation": ("Inflation", "Consumer prices over the last year against the central bank's target. Inflation above target points to higher rates, which tends to support the currency."),
    "growth": ("Growth", "Real GDP growth over the last two quarters. A growing economy tends to attract capital."),
    "labour": ("Labour market", "The change in the unemployment rate over three months. Falling unemployment is a sign of strength."),
    "business": ("Business confidence", "The OECD business confidence index (100 = long-run average) and its direction."),
    "trend": ("Price trend", "The pair's price against its 20, 50 and 200-day averages, and whether the 50-day average is rising."),
    "retail": ("Retail sentiment", "The share of retail traders who are long this pair. Read contrarian: a crowd heavily long scores bearish."),
}
# The Academy lesson that teaches each factor (designer note).
FACTOR_LESSON = {
    "cot": "l1-what-moves-currency-prices",
    "rates": "l5-why-interest-rates-move-currencies",
    "inflation": "l5-actual-versus-expected",
    "growth": "l5-the-economic-calendar",
    "labour": "l5-actual-versus-expected",
    "business": "l5-the-economic-calendar",
    "trend": "l4-moving-averages",
    "retail": "l3-chasing-and-fear-of-missing-out",
}

# Estimated publication lag (days after the period ends) for the historical replay (analyst note).
RELEASE_LAG_DAYS = {"cot": 3, "rates": 0, "inflation": 15, "growth": 45, "labour": 30, "business": 10, "trend": 0, "retail": 0}

DISCLAIMER = "Educational analysis of fundamentals, not a trade signal."

# --- Evidence: official publications and news (analyst notes, docs/scanner §7) ---------------

# Central bank press feeds (RSS/Atom), probed 17 Oct 2026. The RBA blocks automated
# requests, so AUD has no feed; its official pages are still linked below.
CENTRAL_BANK_FEEDS = {
    "USD": ["https://www.federalreserve.gov/feeds/press_monetary.xml", "https://www.federalreserve.gov/feeds/press_all.xml"],
    "EUR": ["https://www.ecb.europa.eu/rss/press.html"],
    "GBP": ["https://www.bankofengland.co.uk/rss/news", "https://www.bankofengland.co.uk/rss/publications"],
    "JPY": ["https://www.boj.or.jp/en/rss/whatsnew.xml"],
    "NZD": ["https://www.rbnz.govt.nz/feeds/news"],
    "CAD": ["https://www.bankofcanada.ca/content_type/press-releases/feed/"],
    "CHF": ["https://www.snb.ch/public/en/rss/pressrel", "https://www.snb.ch/public/en/rss/news"],
}

# Which publications back which factor. Items that match none (bank notes, enforcement
# actions, staff news) are not stored.
NEWS_TOPICS = {
    "rates": ["monetary policy", "interest rate", "interest rates", "policy rate", "bank rate", "cash rate", "federal funds",
              "fomc", "federal open market committee", "discount rate", "rate decision", "policy statement", "press conference",
              "policy assessment", "monetary policy committee", "governing council", "policy board", "statement on monetary"],
    "inflation": ["inflation", "consumer price", "consumer prices", "cpi", "price stability", "prices"],
    "growth": ["gdp", "economic growth", "economic outlook", "the economy", "economic activity", "economic developments",
               "economic conditions", "monetary policy report", "outlook report", "projections", "recession"],
    "labour": ["employment", "labour market", "labor market", "unemployment", "jobs", "wages", "wage"],
    "business": ["business conditions", "business confidence", "business outlook", "tankan", "beige book",
                 "credit conditions survey", "agents' summary", "regional economic report", "business sentiment"],
}

# Housekeeping items that match a topic word but aren't evidence.
NEWS_EXCLUDE = ["data portal", "collateral", "banknote", "bank note", "enforcement action", "appoint", "vacancy", "board launches"]

COT_REPORT = ("CFTC Commitments of Traders", "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm")
OECD_BCI = ("OECD business confidence index", "https://www.oecd.org/en/data/indicators/business-confidence-index-bci.html")

# Where a learner can read the original release: (label, url) per currency and factor.
OFFICIAL_LINKS = {
    "USD": {
        "rates": ("Federal Reserve: FOMC meetings and statements", "https://www.federalreserve.gov/monetarypolicy/openmarket.htm"),
        "inflation": ("US Bureau of Labor Statistics: Consumer Price Index", "https://www.bls.gov/cpi/"),
        "labour": ("US Bureau of Labor Statistics: unemployment (CPS)", "https://www.bls.gov/cps/"),
        "growth": ("US Bureau of Economic Analysis: GDP", "https://www.bea.gov/data/gdp/gross-domestic-product"),
    },
    "EUR": {
        "rates": ("European Central Bank: monetary policy decisions", "https://www.ecb.europa.eu/press/govcdec/mopo/html/index.en.html"),
        "inflation": ("Eurostat: HICP inflation", "https://ec.europa.eu/eurostat/web/hicp"),
        "labour": ("Eurostat: labour force survey", "https://ec.europa.eu/eurostat/web/lfs"),
        "growth": ("Eurostat: national accounts (GDP)", "https://ec.europa.eu/eurostat/web/national-accounts"),
    },
    "GBP": {
        "rates": ("Bank of England: Bank Rate", "https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate"),
        "inflation": ("Office for National Statistics: inflation", "https://www.ons.gov.uk/economy/inflationandpriceindices"),
        "labour": ("Office for National Statistics: labour market", "https://www.ons.gov.uk/employmentandlabourmarket"),
        "growth": ("Office for National Statistics: GDP", "https://www.ons.gov.uk/economy/grossdomesticproductgdp"),
    },
    "JPY": {
        "rates": ("Bank of Japan: monetary policy decisions", "https://www.boj.or.jp/en/mopo/mpmdeci/index.htm"),
        "inflation": ("Statistics Bureau of Japan: CPI", "https://www.stat.go.jp/english/data/cpi/"),
        "labour": ("Statistics Bureau of Japan: labour force survey", "https://www.stat.go.jp/english/data/roudou/"),
        "growth": ("Cabinet Office (ESRI): GDP", "https://www.esri.cao.go.jp/en/sna/menu.html"),
    },
    "AUD": {
        "rates": ("Reserve Bank of Australia: monetary policy", "https://www.rba.gov.au/monetary-policy/"),
        "inflation": ("Australian Bureau of Statistics: inflation", "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation"),
        "labour": ("Australian Bureau of Statistics: labour", "https://www.abs.gov.au/statistics/labour"),
        "growth": ("Australian Bureau of Statistics: national accounts", "https://www.abs.gov.au/statistics/economy/national-accounts"),
    },
    "NZD": {
        "rates": ("Reserve Bank of New Zealand: monetary policy", "https://www.rbnz.govt.nz/monetary-policy"),
        "inflation": ("Stats NZ: key indicators", "https://www.stats.govt.nz/indicators"),
        "labour": ("Stats NZ: key indicators", "https://www.stats.govt.nz/indicators"),
        "growth": ("Stats NZ: key indicators", "https://www.stats.govt.nz/indicators"),
    },
    "CAD": {
        "rates": ("Bank of Canada: policy interest rate", "https://www.bankofcanada.ca/core-functions/monetary-policy/key-interest-rate/"),
        "inflation": ("Statistics Canada: prices and price indexes", "https://www.statcan.gc.ca/en/subjects-start/prices_and_price_indexes"),
        "labour": ("Statistics Canada: labour", "https://www.statcan.gc.ca/en/subjects-start/labour_"),
        "growth": ("Statistics Canada: GDP", "https://www150.statcan.gc.ca/n1/en/subjects/gross_domestic_product"),
    },
    "CHF": {
        "rates": ("Swiss National Bank: monetary policy decisions", "https://www.snb.ch/en/the-snb/mandates-goals/monetary-policy/decisions"),
        "inflation": ("Swiss Federal Statistical Office: prices", "https://www.bfs.admin.ch/bfs/en/home/statistics/prices.html"),
        "labour": ("Swiss Federal Statistical Office: work and income", "https://www.bfs.admin.ch/bfs/en/home/statistics/work-income.html"),
        "growth": ("Swiss Federal Statistical Office: national economy", "https://www.bfs.admin.ch/bfs/en/home/statistics/national-economy.html"),
    },
}


def official_link(code: str, factor: str) -> tuple[str, str] | None:
    if factor == "cot":
        return COT_REPORT
    if factor == "business":
        return OECD_BCI
    return OFFICIAL_LINKS.get(code, {}).get(factor)

# Forex Factory's free weekly calendar (no key, unofficial: cache it, link back, don't resell).
CALENDAR_FEEDS = ["https://nfs.faireconomy.media/ff_calendar_thisweek.json", "https://nfs.faireconomy.media/ff_calendar_nextweek.json"]
CALENDAR_LINK = ("Forex Factory calendar", "https://www.forexfactory.com/calendar")
CALENDAR_IMPACTS = ("High", "Medium")
# Event title words → the scanner factor the release feeds (first match wins).
CALENDAR_FACTORS = [
    ("rates", ["rate statement", "rate decision", "interest rate", "cash rate", "bank rate", "federal funds", "policy rate",
               "monetary policy", "fomc", "mpc", "press conference", "minutes", "boj policy", "snb policy",
               "speaks"]),  # Forex Factory lists central bank heads' speeches as "... Speaks"
    ("inflation", ["cpi", "inflation", "pce", "ppi", "hicp", "price index"]),
    ("labour", ["employment", "unemployment", "non-farm", "nonfarm", "claimant", "jobless", "payroll", "jolts", "earnings", "wage"]),
    ("growth", ["gdp", "retail sales"]),
    ("business", ["pmi", "business confidence", "ism", "tankan", "ifo", "zew", "sentiment", "confidence", "manufacturing", "services"]),
]
