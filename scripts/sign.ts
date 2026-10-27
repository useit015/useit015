// Adds a signature to the guestbook. Run by .github/workflows/guestbook.yml
// with the issue author's login in SIGNER; only that login is ever stored.

import { readFileSync, writeFileSync } from "node:fs";

const login = process.env.SIGNER ?? "";
// GitHub logins: letters, digits and single hyphens, at most 39 characters.
if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(login)) {
  console.error(`Not a GitHub login: ${JSON.stringify(login)}`);
  process.exit(1);
}

const file = new URL("../data/guestbook.json", import.meta.url);
const book: { login: string; at: string }[] = JSON.parse(readFileSync(file, "utf8"));
if (book.some((s) => s.login.toLowerCase() === login.toLowerCase())) {
  console.log(`${login} already signed.`);
  process.exit(0);
}
book.push({ login, at: new Date().toISOString() });
writeFileSync(file, JSON.stringify(book, null, 1) + "\n");
console.log(`${login} signed. ${book.length} signatures.`);
