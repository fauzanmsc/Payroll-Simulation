# Payroll Studio – JEF GROUP

Static HTML/CSS/JavaScript salary simulation tool; no build step, backend server, external library, or API required.

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
    │   └── main.css            # Application & print stylesheet
    └── js/
        ├── config.js           # Field definitions, scenarios, constants & formatters
        ├── calculator.js       # Workday calendar & payroll calculation engine
        ├── database.js         # CSV/JSON parser & database validation
        └── app.js              # DOM state, rendering, export/copy/print handlers
```

## Deploy GitHub Pages

1. Push this repository to GitHub (e.g. `Payroll-Simulation`).
2. Go to **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
3. Open the URL shown by GitHub Pages. For local use, open `index.html` directly in a browser (clipboard support may require HTTPS).

## Database

Export your Excel/Google Sheets database to CSV using the template headers in `assets/templates/database-template.csv` (or prepare a JSON array matching `assets/templates/database-template.json`). Import locally via the file picker.

- `name` and `basic` are required; other numeric fields default to zero.
- Use plain integer rupiah, no currency symbols or thousands separators.
- CSV comma or semicolon delimiters are supported.
- Select an employee, adjust inputs, and calculate. The app does not store or upload the file; refreshing clears imported data.
- **Security note:** Never commit actual salary data to a public repository. GitHub Pages is not an authentication system; anyone with the URL may access the application. Only dummy data is included. For a real restricted shared database, use a separate authenticated backend/hosting solution.

## Logic

- Monday–Saturday workweek; Sundays are excluded. Additional holidays can be entered manually.
- **Full:** fixed salary × 80% or 100%; **Prorata:** rate × eligible workdays / period workdays.
- Transition date is the first day of A100. Optional active bounds apply to prorata cases; blank means the whole period.
- Attendance = eligible workdays − duty days − other absent days, minimum zero. Rp25,000 per day. Duty and absence inputs affect attendance only; adjust active bounds for unpaid eligibility. Non-contiguous unpaid salary deductions may be entered under other deductions.
- Bonuses and duty allowance are actual inputs; BPJS and other deductions are manual, not automatically prorated. Optional A80 BPJS exemption is simulation only, not legal guidance.
- Each A80/A100 subtotal is rounded to the nearest rupiah, with rounding reconciliation in the last nonzero salary line.
- Default example: 24 Oct–23 Nov 2026, transition 13 Nov; 17 A80 and 9 A100 workdays, 24 attendance days, gross Rp4,598,462, deductions Rp138,787, THP Rp4,459,675.
- Verify legal compliance, eligibility, taxes, and actual payroll policy separately.
