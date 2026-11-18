# Ops-doc scripts → read-only reports (PayDiskPanel)

Source: Word ops doc pasted 2026-11-14 («مراحل تهیه دیسکت مستمری / یارانه مراکز»).

**Policy:**
- **AmarDB (prod read):** `SELECT / WITH` only — no `EXEC Calculate*` / `UPDATE` / `DELETE`.
- **Lab (`PAYDISK_USE_TEST_DB=true` → `10.0.28.10` / `DB_Mostamary`):** whitelisted writes allowed from the panel:
  - `EXEC CalculateMarakezYarane @TransactionId, @SupplyLocationId`
  - `UPDATE MakeOverTransactions SET Key2 / Key3` (list / bank flags)
  - API: `POST /api/armaghan/transactions/:id/lab`

Ops-doc `DELETE` / `SELECT INTO` / ad-hoc DDL stay out of the panel even on lab.

## یارانه مراکز (MakeOverTransactions)

| Diskette type (doc) | SupplyLocationId | Calculate (Armaghan/SSMS only) | Report scripts in panel |
|---|---|---|---|
| شبانه روزی توانبخشی | 2 | `CalculateMarakezYarane @TrId, 2` | count PayedMakeOvers · person list · Key2/Key3 gate |
| فرزندان کودکان و نوجوانان | 3 | `… @TrId, 3` | same |
| ویزیت در منزل | 7 | `… @TrId, 7` | same |
| مراقبت در منزل | 8 | `… @TrId, 8` | same |
| روزانه توانبخشی | 9 | `… @TrId, 9` | same |
| خانه حمایتی سالمندان | 25 | `… @TrId, 25` | same |
| خانه حمایتی روانی مزمن | 35 | `… @TrId, 35` | same |
| توانمندسازی اعتیاد | 39 | `… @TrId, 39` | same |
| مدیریت مورد | 43 | `… @TrId, 43` | same |
| CBR شهری | 50 | `… @TrId, 50` | same |
| CBR روستایی | 51 | `… @TrId, 51` | same (+ sample #835 calc-without-list) |
| بهبود تغذیه روزانه | 66 | `… @TrId, 66` | same |

### Doc SELECT templates (parameter `@TrId`)

1. **یافتن تراکنش:** `SELECT … FROM MakeOverTransactions WHERE Id=@TrId`
2. **محل تأمین:** `SELECT … FROM MakeOverSupplyLocation` (catalog)
3. **صحت محاسبه:** `SELECT COUNT(*) FROM PayedMakeOvers WHERE TransactionId=@TrId`
4. **لیست افراد (در صورت لزوم):** join Person/Center/City/Province on `PayedMakeOvers.TransactionId=@TrId`
5. **Gate مدیر:** Key2 خالی + PayedMakeOvers>0 → مسدود مالی؛ Key2 پر → آماده مالی

## مستمری / حق پرستاری / امداد (PayedTransaction)

| Type | Ky | Calculate (SSMS only) | Report scripts in panel |
|---|---|---|---|
| مستمری سازمان | Mst_131500 | `CalculateTransaction` | money histogram · IsDead=0 · missing IBN · base list (if IT table missing → PayedContinusPayment) |
| هدفمندی | Mst_HDF | `CalculateHadafmandi` | same family |
| حق پرستاری خانواده | Mst_F_PRSTRI | `CalculateHaghParastariFamily` | nurse/emdad list + IBN dup check |
| حق پرستاری نخاعی | Mst_PARASTARI | `CalculateHaghParastari` | same |
| کمک هزینه امداد | Mst_Emdad | `CalculateEmdad` | list + IBN dup + missing sheba |

### Doc SELECT templates

- Duplicate IBN accounts (global pretest)
- PayedContinusPayment list + sheba for `@TrId`
- Money distribution / IsDead=0
- Missing IBN join
- Diff persons between two `@TrId`s (optional)

## Manager handoff (brief)

- **مستمری** → Excel / list reports in panel  
- **یارانه** → after Key2 list ready → finance continues; bank Key3 optional outside panel  
- No province write access from this UI  
