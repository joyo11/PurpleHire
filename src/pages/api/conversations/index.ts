// Mohammad Shafay Joyo @ 2025
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const conversations = await prisma.conversation.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          createdAt: true,
          status: true,
          metadata: true,
          messages: {
            take: 1,
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      return res.status(200).json({ 
        conversations: conversations.map(conv => ({
          ...conv,
          createdAt: conv.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Delete all messages first
      await prisma.message.deleteMany();
      
      // Then delete all conversations
      await prisma.conversation.deleteMany();

      return res.status(200).json({ message: 'All conversations deleted successfully' });
    } catch (error) {
      console.error('Error deleting all conversations:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 