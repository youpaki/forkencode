import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260602004800_branch_message",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`branch_message\` (
          \`id\` text PRIMARY KEY,
          \`branch_id\` text NOT NULL,
          \`type\` text NOT NULL,
          \`data\` text NOT NULL,
          \`time_created\` integer NOT NULL,
          CONSTRAINT \`fk_bmsg_branch_id_branch_id_fk\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`CREATE INDEX \`bmsg_branch_idx\` ON \`branch_message\` (\`branch_id\`);`)
      yield* tx.run(`CREATE INDEX \`bmsg_time_idx\` ON \`branch_message\` (\`time_created\`);`)
    })
  },
} satisfies DatabaseMigration.Migration
