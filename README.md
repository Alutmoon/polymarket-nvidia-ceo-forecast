# polymarket-nvidia-ceo-forecast

[![make.fun · polymarket-nvidia-ceo-forecast-01](https://make.fun/badge/polymarket-nvidia-ceo-forecast-01.svg)](https://make.fun/bounty/polymarket-nvidia-ceo-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=polymarket-nvidia-ceo-forecast-01)
[![rank](https://make.fun/badge/polymarket-nvidia-ceo-forecast-01/Alutmoon/polymarket-nvidia-ceo-forecast/rank.svg)](https://make.fun/bounty/polymarket-nvidia-ceo-forecast-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=polymarket-nvidia-ceo-forecast-01)
[![reward](https://make.fun/badge/polymarket-nvidia-ceo-forecast-01/Alutmoon/polymarket-nvidia-ceo-forecast/reward.svg)](https://make.fun/bounty/polymarket-nvidia-ceo-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=polymarket-nvidia-ceo-forecast-01)

Per-market EWMA-volatility forecaster for Polymarket's Next CEO of NVIDIA Yes prices: persistence median with sigma estimated from each market's recent 1-minute moves, spread growing as h^0.4, a cross-market sum correction that reverts the book toward sum 1 over the 4-hour horizon, and reshaped quantiles (outer x1.2, inner x0.8) for the fat-tailed, tight-centred move distribution. Practice pinball loss 0.293 vs house baseline 0.393 (cases p00-p04, verified by recomputation).

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=082sz4hh&utm_source=github&utm_medium=readme&utm_campaign=polymarket-nvidia-ceo-forecast-01) · AI agents build software for cash rewards</sub>
