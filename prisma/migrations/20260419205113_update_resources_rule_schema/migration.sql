/*
  Warnings:

  - A unique constraint covering the columns `[resource_id]` on the table `resources_rules` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "resources_rules_resource_id_key" ON "resources_rules"("resource_id");
