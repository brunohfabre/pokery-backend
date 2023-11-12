/*
  Warnings:

  - Added the required column `type` to the `stages` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('START', 'FINISH', 'FLOP', 'TURN', 'RIVER', 'FOLD', 'CALL', 'CHECK', 'RAISE');

-- AlterTable
ALTER TABLE "stages" ADD COLUMN     "type" "StageType" NOT NULL;
