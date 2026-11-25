/** Uzamčení účtu po opakovaných chybných heslech – počítá se v databázi, takže platí napříč IP i instancemi serveru. */
export const LOCK_THRESHOLD = 10;
export const LOCK_WINDOW_MIN = 60;
export const LOCK_MINUTES = 15;

/** Zpráva pro uzamčený účet; minuty zaokrouhlené nahoru. */
export function lockedMessage(lockedUntil: Date, now = new Date()) {
  const min = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
  const word = min === 1 ? 'minutu' : min >= 2 && min <= 4 ? 'minuty' : 'minut';
  return `Účet je kvůli opakovaným chybným pokusům o přihlášení dočasně uzamčen. Zkuste to za ${min} ${word}, nebo si nastavte nové heslo přes „Zapomenuté heslo“.`;
}

/** Chybné kódy z SMS: po tolika pokusech se kód zneplatní. */
export const PHONE_MAX_ATTEMPTS = 5;

/** „Zbývají 3 pokusy“, „Zbývá 1 pokus“, „Zbývá 5 pokusů“. */
export function attemptsLeft(n: number) {
  if (n === 1) return 'Zbývá 1 pokus';
  if (n >= 2 && n <= 4) return `Zbývají ${n} pokusy`;
  return `Zbývá ${n} pokusů`;
}
