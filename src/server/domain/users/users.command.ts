import { findUser, saveUserFullName } from '@/server/domain/users/users.repository';

export async function updateUser(userId: string, data: { fullName: string }) {
  await saveUserFullName(userId, data.fullName);
  const updatedUser = await findUser(userId);
  if (!updatedUser) {
    throw new Error('User not found');
  }

  return updatedUser;
}
