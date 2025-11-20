-- CreateTable
CREATE TABLE "BasicPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BasicPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BasicPostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BasicPostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BasicPostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BasicPostComment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "FeedActivity" ADD COLUMN "basicPostId" TEXT;

-- CreateIndex
CREATE INDEX "BasicPost_userId_idx" ON "BasicPost"("userId");

-- CreateIndex
CREATE INDEX "BasicPost_createdAt_idx" ON "BasicPost"("createdAt");

-- CreateIndex
CREATE INDEX "BasicPostLike_postId_idx" ON "BasicPostLike"("postId");

-- CreateIndex
CREATE INDEX "BasicPostLike_userId_idx" ON "BasicPostLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BasicPostLike_postId_userId_key" ON "BasicPostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "BasicPostComment_postId_idx" ON "BasicPostComment"("postId");

-- CreateIndex
CREATE INDEX "BasicPostComment_userId_idx" ON "BasicPostComment"("userId");

-- CreateIndex
CREATE INDEX "BasicPostComment_createdAt_idx" ON "BasicPostComment"("createdAt");

-- CreateIndex
CREATE INDEX "FeedActivity_basicPostId_idx" ON "FeedActivity"("basicPostId");

-- AddForeignKey
ALTER TABLE "BasicPost" ADD CONSTRAINT "BasicPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BasicPostLike" ADD CONSTRAINT "BasicPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BasicPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BasicPostLike" ADD CONSTRAINT "BasicPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BasicPostComment" ADD CONSTRAINT "BasicPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BasicPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BasicPostComment" ADD CONSTRAINT "BasicPostComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

