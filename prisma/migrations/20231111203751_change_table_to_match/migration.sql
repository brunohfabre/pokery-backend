/*
  Warnings:

  - You are about to drop the column `tableId` on the `stages` table. All the data in the column will be lost.
  - You are about to drop the `_TableToUser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tables` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `matchId` to the `stages` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_TableToUser" DROP CONSTRAINT "_TableToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_TableToUser" DROP CONSTRAINT "_TableToUser_B_fkey";

-- DropForeignKey
ALTER TABLE "stages" DROP CONSTRAINT "stages_tableId_fkey";

-- AlterTable
ALTER TABLE "stages" DROP COLUMN "tableId",
ADD COLUMN     "matchId" TEXT NOT NULL;

-- DropTable
DROP TABLE "_TableToUser";

-- DropTable
DROP TABLE "tables";

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MatchToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_MatchToUser_AB_unique" ON "_MatchToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_MatchToUser_B_index" ON "_MatchToUser"("B");

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MatchToUser" ADD CONSTRAINT "_MatchToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MatchToUser" ADD CONSTRAINT "_MatchToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
