import { randomBytes, scryptSync } from "node:crypto";
import { stdin as input, stdout as output } from "node:process";

async function readHiddenPassword(prompt) {
  if (!input.isTTY) throw new Error("Run this command in an interactive terminal; do not pass the password through command-line arguments.");
  output.write(prompt);
  input.setRawMode(true);
  input.resume();
  input.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let password = "";
    const done = () => {
      input.off("data", onData);
      input.setRawMode(false);
      output.write("\n");
      resolve(password);
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          input.off("data", onData);
          input.setRawMode(false);
          output.write("\n");
          reject(new Error("Password generation cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") { done(); return; }
        if (character === "\u007f" || character === "\b") { password = password.slice(0, -1); continue; }
        password += character;
      }
    };
    input.on("data", onData);
  });
}

const password = await readHiddenPassword("New admin password: ");
if (!password) throw new Error("A password is required.");
const salt = randomBytes(16).toString("base64url");
const hash = scryptSync(password, salt, 64).toString("base64url");
console.log(`ADMIN_PASSWORD_HASH=scrypt$${salt}$${hash}`);
