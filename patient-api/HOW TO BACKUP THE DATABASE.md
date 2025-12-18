## RUN THIS COMMAND ON PROD ENV

pg_dump -h database-1.cv8g82kya3xt.us-east-2.rds.amazonaws.com -p 5432 -U fusehealth_user -d fusehealth_database --verbose --clean --create > PROD_full_database_dump_10_Nov_2025.sql

e4Uv$^9hJG:K\*)s%

OR LOCALLY:

pg_dump -h localhost -p 5432 -U fusehealth_user -d fusehealth_database --verbose --clean --create > Guilherme_full_database_dump_15_Nov_2025.sql

TO RESTORE (LOCALLY):

psql -h localhost -p 5432 -U guilhermereis -d postgres -c "DROP DATABASE IF EXISTS fusehealth_database;"

psql -h localhost -p 5432 -U guilhermereis -d postgres < Guilherme_full_database_dump_18_Dec_2025.sql

TO RESTORE (PROD):

psql -h localhost -p 5432 -U fusehealth_user -d fusehealth_database < PROD_full_database_dump_03_Oct_2025.sql
