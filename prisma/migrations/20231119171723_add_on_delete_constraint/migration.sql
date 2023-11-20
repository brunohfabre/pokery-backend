-- DropForeignKey
ALTER TABLE "stages" DROP CONSTRAINT "stages_matchId_fkey";

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
