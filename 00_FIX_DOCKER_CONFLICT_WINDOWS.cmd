@echo off
REM SOM PRO Docker cleanup helper.
REM This removes old SOM PRO containers only. It does not delete the database volume.

echo Checking for old SOM PRO Docker containers...
docker rm -f som_redis som_postgres sompro_redis sompro_postgres >nul 2>nul

echo Done.
