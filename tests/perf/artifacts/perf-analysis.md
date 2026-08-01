# Perf Analysis

- Input report: `C:\Users\asus\Desktop\SOM_PRO_Multilingual_Builder_v1_5_5_Database_ENV_Fixed\tests\perf\artifacts\perf-report.json`
- Mode: `baseline`
- Dataset size: `tiny`

## Slowest Endpoints

| Endpoint            | Count | Success p95 ms | All p95 ms | Budget p95 ms | Error rate |
| ------------------- | ----: | -------------: | ---------: | ------------: | ---------: |
| teachers            |    86 |           32.0 |       32.0 |           350 |      0.00% |
| report export event |    51 |           28.0 |       28.0 |           750 |      0.00% |
| certificate save    |     9 |           25.0 |       25.0 |           500 |      0.00% |

## Budget Violations

No budget violations were detected in the current report.

## Explain Plans

EXPLAIN was not requested.
