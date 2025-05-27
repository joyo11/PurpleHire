// Mohammad Shafay Joyo @ 2025
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  if (req.method === 'GET') {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
      const conversation = await prisma.conversation.findUnique({
        where: {
          id: id as string,
        },
        include: {
          messages: {
            orderBy: {
              createdAt: 'asc',
            },
            where: {
              NOT: {
                content: 'Can you tell me your good name?'
              }
            },
            select: {
              id: true,
              content: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });

      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      return res.status(200).json({
        messages: conversation.messages,
        status: conversation.status,
      });
    } catch (error) {
      console.error('Error loading conversation:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  
  if (req.method === 'DELETE') {
    try {
      await prisma.message.deleteMany({
        where: {
          conversationId: id as string,
        },
      });

      await prisma.conversation.delete({
        where: {
          id: id as string,
        },
      });

      return res.status(200).json({ message: 'Conversation deleted successfully' });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { name } = req.body;
      const conversation = await prisma.conversation.findUnique({
        where: { id: id as string },
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const metadata = JSON.parse(conversation.metadata || '{}');
      metadata.name = name;

      await prisma.conversation.update({
        where: { id: id as string },
        data: {
          metadata: JSON.stringify(metadata),
        },
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating conversation:', error);
      res.status(500).json({ error: 'Error updating conversation' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
} 