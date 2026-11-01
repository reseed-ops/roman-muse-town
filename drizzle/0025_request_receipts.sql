CREATE TABLE `request_receipts` (
  `request_id` text PRIMARY KEY NOT NULL,
  `action` text NOT NULL,
  `payload_hash` text NOT NULL,
  `completed_at` integer NOT NULL
);
