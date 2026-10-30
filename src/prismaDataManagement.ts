
import { Prisma, PrismaClient } from '@prisma/client';
import * as CryptoJs from 'crypto-js';

const prisma = new PrismaClient();

type AuthCreateInput = {
    userAuthID: bigint;
    Name: string;
    email: string;
    userRefID: string;
    encryptionKey: string;
    userId: string;
};

type AuthUpdateInput = {
    userAuthID?: bigint;
    Name?: string;
    email?: string;
    userRefID?: string;
    encryptionKey?: string;
};

type UserCreateInput = {
    authId?: string;
    userName: string;
    surname: string;
    email: string;
    password: string;
    userRefID: string;
    encryptionKey?: string;
};

type UserUpdateInput = {
    userRefID?: string;
    userName?: string;
    surname?: string;
    email?: string;
    password?: string;
    encryptionKey?: string;
};

export async function connectPrismaClient(): Promise<void> {
    await prisma.$connect();
}

export async function disconnectPrismaClient(): Promise<void> {
    await prisma.$disconnect();
}

export function getPrismaClient(): PrismaClient {
    return prisma;
}

export async function verifyInputEmail(
    userRefID: string,
    providedEmail: string
): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { userRefID },
        select: {
            email: true,
            encryptionKey: true
        }
    });

    if (!user || !user.encryptionKey) {
        return false;
    }

    const decryptedEmail = CryptoJs.AES.decrypt(
        user.email,
        user.encryptionKey
    ).toString(CryptoJs.enc.Utf8);

    return decryptedEmail.length > 0 &&
        decryptedEmail === providedEmail;
}

export async function verifyInputName(
    userRefID: string,
    providedName: string
): Promise<boolean> {
    const dataAuth = await prisma.dataAuth.findUnique({
        where: { userRefID },
        select: {
            name: true, 
            encryptionKey: true
        }
    });

    if (!dataAuth) {
        return false;
    }

    const decryptedName = CryptoJs.AES.decrypt(
        dataAuth.name,
        dataAuth.encryptionKey
    ).toString(CryptoJs.enc.Utf8);

    return decryptedName.length > 0 &&
        decryptedName === providedName;
}

export function getAllUsers() {
    return prisma.user.findMany({
        include: {
            dataAuth: true
        }
    });
}

export function getAllDataAuths() {
    return prisma.dataAuth.findMany({
        include: {
            user: true
        }
    });
}

export function getUserByRefID(userRefID: string) {
    return prisma.user.findUnique({
        where: { userRefID },
        include: {
            dataAuth: true
        }
    });
}

export function getDataAuthByUserRefID(userRefID: string) {
    return prisma.dataAuth.findUnique({
        where: { userRefID },
        include: {
            user: true
        }
    });
}

export function getUserById(id: string) {
    return prisma.user.findUnique({
        where: { id },
        include: {
            dataAuth: true
        }
    });
}

export function getDataAuthById(id: string) {
    return prisma.dataAuth.findUnique({
        where: { id },
        include: {
            user: true
        }
    });
}

export async function getUserByEmail(email: string) {
    const users = await prisma.user.findMany({
        include: {
            dataAuth: true
        }
    });

    return users.find(user => {
        if (!user.encryptionKey) {
            return false;
        }

        const decryptedEmail = CryptoJs.AES.decrypt(
            user.email,
            user.encryptionKey
        ).toString(CryptoJs.enc.Utf8);

        return decryptedEmail === email;
    }) ?? null;
}

export async function getDataAuthByEmail(email: string) {
    const auths = await prisma.dataAuth.findMany({
        include: {
            user: true
        }
    });

    return auths.find(auth => {
        const decryptedEmail = CryptoJs.AES.decrypt(
            auth.email,
            auth.encryptionKey
        ).toString(CryptoJs.enc.Utf8);

        return decryptedEmail === email;
    }) ?? null;
}

export async function findUserByIdentifier(identifier: string) {
    const user = await prisma.user.findUnique({
        where: { userRefID: identifier },
        include: {
            dataAuth: true
        }
    });

    if (user) {
        return user;
    }

    return getUserByEmail(identifier);
}

export async function findDataAuthByIdentifier(identifier: string) {
    const dataAuth = await prisma.dataAuth.findUnique({
        where: { userRefID: identifier },
        include: {
            user: true
        }
    });

    if (dataAuth) {
        return dataAuth;
    }

    return getDataAuthByEmail(identifier);
}

export async function createUser(data: UserCreateInput) {
    return prisma.user.create({
        data: {
            userName: data.userName,
            surname: data.surname,
            email: data.email,
            password: data.password,
            userRefID: data.userRefID,
            ...(data.encryptionKey !== undefined // ... oznaczają, że jeśli encryptionKey jest zdefiniowany, dodajemy go do obiektu danych
                ? { encryptionKey: data.encryptionKey }
                : {})
        },
        include: {
            dataAuth: true
        }
    });
}

export async function createDataAuth(data: AuthCreateInput) {
    return prisma.dataAuth.create({
        data: {
            userAuthID: data.userAuthID,
            name: data.Name,
            email: data.email,
            userRefID: data.userRefID,
            encryptionKey: data.encryptionKey,
            userId: data.userId
        },
        include: {
            user: true
        }
    });
}

export function updateUserByRefID(
    userRefID: string,
    userData: UserUpdateInput
) {
    return prisma.user.update({
        where: { userRefID },
        data: userData,
        include: {
            dataAuth: true
        }
    });
}

export function updateDataAuthByUserRefID(
    userRefID: string,
    authData: AuthUpdateInput
) {
    return prisma.dataAuth.update({
        where: { userRefID },
        data: {
            ...(authData.userAuthID !== undefined
                ? { userAuthID: authData.userAuthID }
                : {}),
            ...(authData.Name !== undefined
                ? { name: authData.Name }
                : {}),
            ...(authData.email !== undefined
                ? { email: authData.email }
                : {}),
            ...(authData.userRefID !== undefined
                ? { userRefID: authData.userRefID }
                : {}),
            ...(authData.encryptionKey !== undefined
                ? { encryptionKey: authData.encryptionKey }
                : {})
        },
        include: {
            user: true
        }
    });
}

export function deleteUserByRefID(userRefID: string) {
    return prisma.user.delete({
        where: { userRefID }
    });
}

export function deleteDataAuthByUserRefID(userRefID: string) {
    return prisma.dataAuth.delete({
        where: { userRefID }
    });
}

export function getAllDataAuthsAfter(date: Date) {
    return prisma.dataAuth.findMany({
        where: {
            createdAt: {
                gt: date
            }
        },
        include: {
            user: true
        }
    });
}

export async function createUserCongregate(
    userData: UserCreateInput,
    authData: Omit<AuthCreateInput, 'userId'>
) {
    return prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
            const user = await tx.user.create({
                data: {
                    userName: userData.userName,
                    surname: userData.surname,
                    email: userData.email,
                    password: userData.password,
                    userRefID: userData.userRefID,
                    ...(userData.encryptionKey !== undefined
                        ? { encryptionKey: userData.encryptionKey }
                        : {})
                }
            });

            const dataAuth = await tx.dataAuth.create({
                data: {
                    userAuthID: authData.userAuthID,
                    name: authData.Name,
                    email: authData.email,
                    userRefID: authData.userRefID,
                    encryptionKey: authData.encryptionKey,
                    userId: user.id
                }
            });

            return {
                user,
                dataAuth
            };
        }
    );
}

export async function updateUserCongregate(
    userRefID: string,
    userData: UserUpdateInput,
    authData: AuthUpdateInput
) {
    return prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
            const user = await tx.user.update({
                where: { userRefID },
                data: userData
            });

            const dataAuth = await tx.dataAuth.update({
                where: { userId: user.id },
                data: {
                    ...(authData.userAuthID !== undefined
                        ? { userAuthID: authData.userAuthID }
                        : {}),
                    ...(authData.Name !== undefined
                        ? { name: authData.Name }
                        : {}),
                    ...(authData.email !== undefined
                        ? { email: authData.email }
                        : {}),
                    ...(authData.userRefID !== undefined
                        ? { userRefID: authData.userRefID }
                        : {}),
                    ...(authData.encryptionKey !== undefined
                        ? { encryptionKey: authData.encryptionKey }
                        : {})
                }
            });

            return {
                user,
                dataAuth
            };
        }
    );
}

export async function deleteUserCongregate(userRefID: string) {
    return prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
            const user = await tx.user.findUniqueOrThrow({
                where: { userRefID }
            });

            const dataAuth = await tx.dataAuth.deleteMany({
                where: {
                    userId: user.id
                }
            });

            const deletedUser = await tx.user.delete({
                where: { id: user.id }
            });

            return {
                user: deletedUser,
                dataAuth
            };
        }
    );
}

export function indicateUserCongregate(userRefID: string) {
    return prisma.user.findUnique({
        where: { userRefID },
        include: {
            dataAuth: true
        }
    });
}
