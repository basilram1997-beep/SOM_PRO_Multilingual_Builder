-- Extend the existing UserRole enum so student and parent accounts can be stored in the database.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STUDENT';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PARENT';
