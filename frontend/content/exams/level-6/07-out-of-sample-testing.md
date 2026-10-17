---
module: out-of-sample-testing
level: 6
---
::question{id="oos-1" lesson="l6-development-and-validation-data"}
Development data is:
- [x] The period where you build and adjust your rules
- [ ] Data you never look at
- [ ] Your live trading results
? You can tune rules here; validation data stays untouched.
::
::question{id="oos-2" lesson="l6-development-and-validation-data"}
Validation (out-of-sample) data must be:
- [x] Kept untouched until the rules are final
- [ ] Used to tune the settings
- [ ] Chosen after seeing the results
? Its value comes from being unseen while you build the strategy.
::
::question{id="oos-3" lesson="l6-development-and-validation-data"}
In EdgeProof, how much validation data is required, and where does it sit?
- [x] At least 12 months, placed after the development period
- [ ] One week, before development
- [ ] Any random days you choose
? Validation follows development, like the future follows the past.
::
::question{id="oos-4" lesson="l6-development-and-validation-data"}
You test on validation data, it fails, so you tweak the rules and test it again. What's the problem?
- [x] The validation data is no longer unseen, so it has become development data
- [ ] Nothing; that's how testing works
- [ ] Validation data can only be used on weekends
? Each look at validation data uses up its independence.
::
::question{id="oos-5" lesson="l6-reading-your-verdict"}
To pass out-of-sample, the validation profit factor must be at least:
- [x] 1.25
- [ ] 0.5
- [ ] 3.0
? Every condition must hold, including a validation profit factor of at least 1.25.
::
::question{id="oos-6" lesson="l6-reading-your-verdict"}
Development expectancy is +0.30R and validation is +0.12R. Every other condition passes. Does it pass?
- [ ] Yes
- [x] No, because validation is less than half of development
- [ ] No, because validation expectancy must be higher than development
? Validation must hold at least half the development figure (+0.15R here).
::
::question{id="oos-7" lesson="l6-reading-your-verdict"}
"No edge found yet" means:
- [x] At least one pass condition failed, so the evidence doesn't support an edge
- [ ] The strategy is proven to lose money
- [ ] You need to trade it live to find out
? It's a statement about evidence, not a proof that no edge could exist.
::
::question{id="oos-8" lesson="l6-reading-your-verdict"}
The lower end of the expectancy range must be above zero. Why?
- [x] So that even the cautious estimate of the edge is positive
- [ ] So the average looks bigger
- [ ] Because brokers require it
? If the range includes zero, the edge might not be real.
::
