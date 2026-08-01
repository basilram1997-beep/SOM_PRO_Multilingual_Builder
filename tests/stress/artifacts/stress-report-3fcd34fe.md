# Stress Test Report

- Run ID: `3fcd34fe`
- School ID: `stress-3fcd34fe`
- API URL: `http://127.0.0.1:4000`
- Scenario: `login`

| Scenario    | Requests | Success | Errors | Error rate | p95 ms | p99 ms | Safe failure |
| ----------- | -------: | ------: | -----: | ---------: | -----: | -----: | ------------ |
| login burst |        4 |       3 |      1 |      25.0% |   72.8 |   72.8 | Yes          |

## Safe Failure Notes

- Login burst should return clean 200 responses once accounts exist.
- Grade burst is safe when allowed saves persist one row and rejected saves stay 403.
- Attendance burst is safe when rows remain unique by student/date.
- The outage simulation is a local fault-injection run that stops the backend mid-save; any true database shutdown test should be repeated on staging with the DB service stopped explicitly.
