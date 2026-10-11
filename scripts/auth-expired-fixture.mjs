// Development QA only: stop the embedded app before running this script.
import { PGlite } from "@electric-sql/pglite";
import { randomBytes, createHash } from "node:crypto";
import { resolve, relative, isAbsolute } from "node:path";
import { writeFile } from "node:fs/promises";
if (
  process.env.NODE_ENV !== "development" ||
  process.env.DATABASE_DRIVER !== "pglite"
)
  throw Error("Disabled");
const root = resolve(".data");
const path = resolve(
  process.env.DEV_DATABASE_PATH ?? ".data/postgres-saas-dev-fixed",
);
const rel = relative(root, path);
if (rel.startsWith("..") || isAbsolute(rel)) throw Error("InvalidDevPath");
const client = new PGlite(path);
try {
  const token = randomBytes(32).toString("base64url");
  await client.transaction(async (tx) => {
    const { rows: users } = await tx.query(
      "SELECT id FROM users WHERE email=$1",
      ["ali@development.example.invalid"],
    );
    const { rows: organizations } = await tx.query(
      "SELECT id FROM organizations WHERE slug=$1",
      ["saas-dev-alpha"],
    );
    if (!users.length || !organizations.length)
      throw Error("DevelopmentSeedMissing");
    await tx.query(
      "INSERT INTO organization_invitations (organization_id,email,invited_by_user_id,token_hash,expires_at,status) VALUES ($1,$2,$3,$4,$5,'Pending')",
      [
        organizations[0].id,
        "expired-qa@development.example.invalid",
        users[0].id,
        createHash("sha256").update(token).digest("hex"),
        new Date(Date.now() - 60000),
      ],
    );
  });
  await writeFile(
    resolve(root, "qa-expired-invitation.json"),
    JSON.stringify({ url: "http://127.0.0.1:3000/invite/" + token }),
  );
  console.log(
    "Expired development invitation prepared; fixture is ignored and token is not logged.",
  );
} finally {
  await client.close();
}
