# Stress Test Report

- Run ID: `94245408`
- School ID: `stress-94245408`
- API URL: `http://127.0.0.1:4000`
- Scenario: `outage`

| Scenario          | Requests | Success | Errors | Error rate | p95 ms | p99 ms | Safe failure |
| ----------------- | -------: | ------: | -----: | ---------: | -----: | -----: | ------------ |
| outage save burst |       40 |      10 |     30 |      75.0% |   93.9 |   98.1 | Yes          |

## Safe Failure Notes

- Login burst should return clean 200 responses once accounts exist.
- Grade burst is safe when allowed saves persist one row and rejected saves stay 403.
- Attendance burst is safe when rows remain unique by student/date.
- The outage simulation is a local fault-injection run that stops the backend mid-save; any true database shutdown test should be repeated on staging with the DB service stopped explicitly.
