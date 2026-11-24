# Payroll Studio – JEF GROUP

Static HTML/CSS/JavaScript salary simulation tool with a modern UI, branded loader screen, and 1-page A4 landscape PDF print layout. No build step, backend server, external JS library, or API required.

## Project Structure

```text
Payroll-Simulation/
├── index.html                  # Main application entry point (GitHub Pages root)
├── README.md                   # Project documentation
├── .gitignore                  # Git ignore rules (including local payroll data)
├── assets/
│   └── templates/
│       ├── database-template.csv
│       └── database-template.json
└── src/
    ├── styles/
    │   └── main.css            # Application, loader & A4 landscape print stylesheet
    └── js/
        ├── config.js           # Field definitions, scenarios, constants & formatters
        ├── calculator.js       # Workday calendar & payroll calculation engine
        ├── database.js         # CSV/JSON parser & database validation
        └── app.js              # DOM state, loader, rendering, print & export handlers
```

## Deploy GitHub Pages

1. Push this repository to GitHub (e.g. `Payroll-Simulation`).
2. Go to **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
3. Open the URL shown by GitHub Pages. For local use, open `index.html` directly in a browser (clipboard support may require HTTPS).

## Database

Export your Excel/Google Sheets database to CSV using the template headers in `assets/templates/database-template.csv` (or prepare a JSON array matching `assets/templates/database-template.json`). Import locally via the **Data Karyawan** drawer.

- `name` and `basic` are required; other numeric fields default to zero.
- Use plain integer rupiah, no currency symbols or thousands separators.
- CSV comma or semicolon delimiters are supported.
- Select an employee, adjust inputs, and calculate. The app does not store or upload the file; refreshing clears imported data.
- **Security note:** Never commit actual salary data to a public repository. GitHub Pages is not an authentication system; anyone with the URL may access the application. Only dummy data is included.

## Logic

- Monday–Saturday workweek; Sundays are excluded. Additional holidays can be entered manually.
- **Kontrak 3 Bulan (80%)** & **Kontrak 1 Tahun (100%)** support full-period, partial-period (prorata), and mid-period transition calculations.
- Attendance allowance = eligible workdays − duty days − other absent days (minimum zero) × Rp25,000/day. Duty and absence inputs affect attendance allowance only.
- Bonuses and additional variable income are actual inputs; BPJS and other deductions are manual and not automatically prorated. Optional BPJS exemption for pure 3-month contract is simulation only.
- Each contract-phase subtotal is rounded to the nearest rupiah, with rounding reconciliation in the last nonzero salary line.
- Default example: 24 Oct–23 Nov 2026, transition 13 Nov; 17 days (80%) and 9 days (100%), 24 attendance days, gross Rp4,598,462, deductions Rp138,787, net pay Rp4,459,675.
- Printing/Exporting to PDF uses a dedicated **1-page A4 landscape** executive layout.
