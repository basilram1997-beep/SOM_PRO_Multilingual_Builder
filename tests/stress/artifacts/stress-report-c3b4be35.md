# Stress Test Report

- Run ID: `c3b4be35`
- School ID: `stress-c3b4be35`
- API URL: `http://127.0.0.1:4000`
- Scenario: `all`

| Scenario            | Requests | Success | Errors | Error rate | p95 ms | p99 ms | Safe failure |
| ------------------- | -------: | ------: | -----: | ---------: | -----: | -----: | ------------ |
| login burst         |        4 |       3 |      1 |      25.0% |   64.5 |   64.5 | Yes          |
| grade burst         |        4 |       2 |      2 |      50.0% |   32.0 |   32.0 | Yes          |
| attendance burst    |       20 |      17 |      3 |      15.0% |   34.6 |   35.0 | No           |
| report export burst |        4 |       4 |      0 |       0.0% |   28.0 |   28.0 | Yes          |
| outage save burst   |       40 |       0 |     40 |     100.0% |   80.6 |   89.3 | Yes          |

## Safe Failure Notes

- Login burst should return clean 200 responses once accounts exist.
- Grade burst is safe when allowed saves persist one row and rejected saves stay 403.
- Attendance burst is safe when rows remain unique by student/date.
- The outage simulation is a local fault-injection run that stops the backend mid-save; any true database shutdown test should be repeated on staging with the DB service stopped explicitly.
