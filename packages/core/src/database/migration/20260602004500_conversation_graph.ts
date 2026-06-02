import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260602004500_conversation_graph",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`conversation\` (
          \`id\` text PRIMARY KEY,
          \`project_id\` text NOT NULL,
          \`root_branch_id\` text NOT NULL,
          \`title\` text NOT NULL,
          \`agent\` text,
          \`model\` text,
          \`metadata\` text,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          \`time_archived\` integer,
          CONSTRAINT \`fk_conversation_project_id_project_id_fk\` FOREIGN KEY (\`project_id\`) REFERENCES \`project\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`CREATE INDEX \`conv_project_idx\` ON \`conversation\` (\`project_id\`);`)
      yield* tx.run(`CREATE INDEX \`conv_root_branch_idx\` ON \`conversation\` (\`root_branch_id\`);`)

      yield* tx.run(`
        CREATE TABLE \`branch\` (
          \`id\` text PRIMARY KEY,
          \`conversation_id\` text NOT NULL,
          \`parent_id\` text,
          \`purpose\` text NOT NULL,
          \`fork_type\` text,
          \`inheritance_mode\` text NOT NULL DEFAULT 'full',
          \`status\` text NOT NULL DEFAULT 'running',
          \`summary\` text,
          \`confidence\` real,
          \`agent\` text,
          \`model\` text,
          \`token_budget\` integer,
          \`depth\` integer NOT NULL DEFAULT 0,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL,
          \`time_archived\` integer,
          CONSTRAINT \`fk_branch_conversation_id_conversation_id_fk\` FOREIGN KEY (\`conversation_id\`) REFERENCES \`conversation\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_branch_parent_id_branch_id_fk\` FOREIGN KEY (\`parent_id\`) REFERENCES \`branch\`(\`id\`) ON DELETE SET NULL
        );
      `)
      yield* tx.run(`CREATE INDEX \`branch_conversation_idx\` ON \`branch\` (\`conversation_id\`);`)
      yield* tx.run(`CREATE INDEX \`branch_parent_idx\` ON \`branch\` (\`parent_id\`);`)
      yield* tx.run(`CREATE INDEX \`branch_depth_conversation_idx\` ON \`branch\` (\`conversation_id\`,\`depth\`);`)

      yield* tx.run(`
        CREATE TABLE \`branch_relationship\` (
          \`ancestor_id\` text NOT NULL,
          \`descendant_id\` text NOT NULL,
          \`depth\` integer NOT NULL,
          PRIMARY KEY (\`ancestor_id\`, \`descendant_id\`),
          CONSTRAINT \`fk_br_ancestor_id_branch_id_fk\` FOREIGN KEY (\`ancestor_id\`) REFERENCES \`branch\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_br_descendant_id_branch_id_fk\` FOREIGN KEY (\`descendant_id\`) REFERENCES \`branch\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`CREATE INDEX \`br_descendant_idx\` ON \`branch_relationship\` (\`descendant_id\`);`)

      yield* tx.run(`
        CREATE TABLE \`merge\` (
          \`id\` text PRIMARY KEY,
          \`target_branch_id\` text NOT NULL,
          \`source_branch_ids\` text NOT NULL,
          \`strategy\` text NOT NULL,
          \`explanation\` text NOT NULL,
          \`resolution\` text NOT NULL,
          \`confidence\` real NOT NULL,
          \`status\` text NOT NULL DEFAULT 'pending',
          \`time_created\` integer NOT NULL,
          \`time_completed\` integer,
          CONSTRAINT \`fk_merge_target_branch_id_branch_id_fk\` FOREIGN KEY (\`target_branch_id\`) REFERENCES \`branch\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`CREATE INDEX \`merge_target_idx\` ON \`merge\` (\`target_branch_id\`);`)

      yield* tx.run(`
        CREATE TABLE \`checkpoint\` (
          \`id\` text PRIMARY KEY,
          \`branch_id\` text NOT NULL,
          \`message_id\` text NOT NULL,
          \`snapshot\` text NOT NULL,
          \`summary\` text NOT NULL,
          \`time\` integer NOT NULL,
          CONSTRAINT \`fk_checkpoint_branch_id_branch_id_fk\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`CREATE INDEX \`checkpoint_branch_idx\` ON \`checkpoint\` (\`branch_id\`);`)

      yield* tx.run(`
        CREATE TABLE \`context_snapshot\` (
          \`id\` text PRIMARY KEY,
          \`branch_id\` text NOT NULL,
          \`source_branch_id\` text NOT NULL,
          \`inheritance_mode\` text NOT NULL,
          \`included_message_count\` integer NOT NULL,
          \`total_token_estimate\` integer NOT NULL,
          \`summary\` text NOT NULL,
          \`time\` integer NOT NULL,
          CONSTRAINT \`fk_cs_branch_id_branch_id_fk\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_cs_source_branch_id_branch_id_fk\` FOREIGN KEY (\`source_branch_id\`) REFERENCES \`branch\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`CREATE INDEX \`cs_branch_idx\` ON \`context_snapshot\` (\`branch_id\`);`)

      yield* tx.run(`
        CREATE TABLE \`fork_plan\` (
          \`id\` text PRIMARY KEY,
          \`conversation_id\` text NOT NULL,
          \`source_branch_id\` text NOT NULL,
          \`planned_forks\` text NOT NULL,
          \`rationale\` text NOT NULL,
          \`status\` text NOT NULL DEFAULT 'planned',
          \`time\` integer NOT NULL,
          CONSTRAINT \`fk_fp_conversation_id_conversation_id_fk\` FOREIGN KEY (\`conversation_id\`) REFERENCES \`conversation\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_fp_source_branch_id_branch_id_fk\` FOREIGN KEY (\`source_branch_id\`) REFERENCES \`branch\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`CREATE INDEX \`fp_conversation_idx\` ON \`fork_plan\` (\`conversation_id\`);`)
    })
  },
} satisfies DatabaseMigration.Migration
