# Stress Test Report

- Run ID: `f06ae538`
- School ID: `stress-f06ae538`
- API URL: `http://127.0.0.1:4000`
- Scenario: `all`

| Scenario            | Requests | Success | Errors | Error rate | p95 ms | p99 ms | Safe failure |
| ------------------- | -------: | ------: | -----: | ---------: | -----: | -----: | ------------ |
| login burst         |        4 |       3 |      1 |      25.0% |   69.5 |   69.5 | Yes          |
| grade burst         |        4 |       2 |      2 |      50.0% |   19.5 |   19.5 | Yes          |
| attendance burst    |       20 |      17 |      3 |      15.0% |   40.3 |   42.3 | Yes          |
| report export burst |        4 |       4 |      0 |       0.0% |   16.9 |   16.9 | Yes          |
| outage save burst   |       40 |       0 |     40 |     100.0% |   84.7 |   87.8 | Yes          |

## Safe Failure Notes

- Login burst should return clean 200 responses once accounts exist.
- Grade burst is safe when allowed saves persist one row and rejected saves stay 403.
- Attendance burst is safe when rows remain unique by student/date.
- The outage simulation is a local fault-injection run that stops the backend mid-save; any true database shutdown test should be repeated on staging with the DB service stopped explicitly.
