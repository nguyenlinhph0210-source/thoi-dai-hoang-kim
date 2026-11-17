import { auditSql } from "./sqlSafety";
auditSql()
  .then(() => {
    console.log(
      "SQL WHERE guard passed (immutable 0005 incident requires its 0006 replacement).",
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
