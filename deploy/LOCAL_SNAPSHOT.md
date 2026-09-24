# Import a production database snapshot locally

`vps-export-data.yml` is the only workflow to use for this task. It reads the
production MySQL database through `mysqldump --single-transaction`, streams the
SQL over SSH, and encrypts it on the GitHub runner. It does not write files or
change database rows on the VPS. The uploaded artifact is encrypted and expires
after three days. Uploaded photos and other files outside MySQL are not part of
the database snapshot.

The local private key is `database/production_snapshot_private.pem`. The
`database/` directory is ignored by Git. Keep this key private and backed up:
the GitHub artifact cannot be decrypted without it. The matching public key in
`deploy/production-snapshot-public.key` is safe to commit.

## Run and download

1. Publish the workflow, exporter, crypto script, and public key on a separate
   branch. Do not merge this branch into `merged-all-branches` for the export:
   pushes to that branch trigger automatic VPS deployment for non-workflow files.
2. In GitHub Actions, run **Export encrypted production database snapshot**
   manually and select the separate branch. The CLI equivalent is
   `gh workflow run vps-export-data.yml --ref BRANCH_NAME`. Do not run the
   retired diagnose or reallocate workflows.
3. Download the `production-database-encrypted` artifact from that run. With
   GitHub CLI, use:

   ```powershell
   gh run download RUN_ID --name production-database-encrypted --dir database/snapshot-download
   ```

4. Import into a new local database:

   ```powershell
   node scripts/import-db-snapshot.mjs `
     database/snapshot-download/production-snapshot.sql.gz.enc `
     database/production_snapshot_private.pem `
     'C:\Users\vigne\AppData\Local\Programs\FlyEnv-Data\app\mariadb-11.8.6\bin\mysql.exe'
   ```

The importer authenticates the encrypted file before creating the database. It
requires `.env.local` to point to local MySQL, creates a unique
`loantrack_prod_snapshot_*` database, prints table and row counts, and removes
the temporary decrypted dump. It never selects or drops an existing database.
It does not change `.env.local` or start the app against production data.

The clone contains real customer information, account records, and password
hashes. Keep the artifact and local clone private. Explore it with a local SQL
client; do not use it for sending messages or taking payments.
