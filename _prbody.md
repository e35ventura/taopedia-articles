## What

Adds a sourced **Development Stage Context** section to `pruning_score`, matching the maintainer's active campaign (#5197–#5221) of grounding concept articles across localnet → testnet → mainnet.

The page explains pruning-score displacement and notes it is live state, but does not distinguish how a displacement example should be read across development stages. The new section explains:

- **localnet** — registration/deregistration exercised in isolation; the displacement reflects test chain state, not competition for a production slot.
- **testnet** — pruning pressure on a shared non-production network, separate from mainnet registrations/emissions.
- **mainnet** — pruning score decides which incumbent makes way on live subnets (e.g. netuid 1), where registrations consume real TAO and emissions reflect production rewards.

It closes by citing the `Bittensor Networks` separation so a lowest-pruning-score example from one environment is not read as the standing on another.

## Sources

- [Introduction to Bittensor — subnet development](https://docs.learnbittensor.org/learn/introduction#subnet-development)
- [Bittensor Networks](https://docs.learnbittensor.org/concepts/bittensor-networks)
- [Mining in Bittensor](https://docs.learnbittensor.org/miners)

## Validation

- `npm run validate` passes.
- Formatted with the repo Prettier config (`proseWrap: always`, printWidth 100); only the new section changed.

Targets `test` per CONTRIBUTING.
