import sql from "mssql";

import { sqlConfig } from "../../core/config/sql_config.js";

export const storeQuestion = async (question) => {
  let database = await sql.connect(sqlConfig);

  try {
    await database
      .request()
      .input("question", sql.VarChar(200), question)
      .execute("storeQuestion");
  } catch (err) {
    console.log(err);
  } finally {
    database.close();
  }
};
