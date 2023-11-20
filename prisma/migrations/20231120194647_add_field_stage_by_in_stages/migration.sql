/*
  Warnings:

  - Added the required column `stageBy` to the `stages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "stages" ADD COLUMN     "stageBy" TEXT NOT NULL;
