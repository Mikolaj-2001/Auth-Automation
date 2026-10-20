// Requires: `npx prisma generate`
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type AuthCreateInput = {
    userAuthID: bigint;
    Name: string;
    email: string;
    userRefID: string;
    encryptionKey?: string;
};

type AuthUpdateInput = {
    userAuthID?: bigint;
    Name?: string;
    email?: string;
    userRefID?: string;
    encryptionKey?: string;
};

type UserCreateInput = {
    authId: string;
    userName: string;
    Surname: string;
    email: string;
    password: string;
    userRefID: string;
    encryptionKey?: string;
};

type UserUpdateInput = {
    userRefID?: string;
    userName?: string;
    Surname?: string;
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

export function getAllUsers() {
    return prisma.user.findMany({
        include: {
            auth: true,
        }
    });
}

export function getAllAuths() {
    return prisma.auth.findMany({
        include: {
            users: true,
        }
    });
}

export function getUserByRefID(userRefID: string) {
    return prisma.user.findUnique({
        where: {
            userRefID: userRefID,
        },
        include: {
            auth: true,
        }
    });
}

export function getAuthByUserRefID(userRefID: string) {
    return prisma.auth.findUnique({
        where: {
            userRefID: userRefID,
        },
        include: {
            users: true,
        }
    });
}

export function getUserByEmail(email: string) {
    return prisma.user.findUnique({
        where: {
            email: email,
        },
        include: {
            auth: true,
        }
    });
}

export function getAuthByEmail(email: string) {
    return prisma.auth.findUnique({
        where: {
            email: email,
        },
        include: {
            users: true,
        }
    });
}

export function findUserByIdentifier(identifier: string) {
    return prisma.user.findFirst({
        where: {
            OR: [
                { email: identifier },
                { userRefID: identifier }
            ]
        }
    });
}

export function findAuthByIdentifier(identifier: string) {
    return prisma.auth.findFirst({
        where: {
            OR: [
                { email: identifier },
                { userRefID: identifier }
            ]
        }
    });
}

export function createUser(data: UserCreateInput) {
    return prisma.user.create({
        data: {
            userName: data.userName,
            Surname: data.Surname,
            email: data.email,
            password: data.password,
            userRefID: data.userRefID,
            encryptionKey: data.encryptionKey,
            auth: { connect: { authId: data.authId } },
        }
    });
}

export function createAuth(data: AuthCreateInput) {
    return prisma.auth.create({
        data: {
            userAuthID: data.userAuthID,
            Name: data.Name,
            email: data.email,
            userRefID: data.userRefID,
            encryptionKey: data.encryptionKey,
        }
    });
}

export function updateUserByRefID(userRefID: string, userData: UserUpdateInput) {
    return prisma.user.update({
        where: {
            userRefID: userRefID,
        },
        data: userData,
    });
}

export function updateAuthByUserRefID(userRefID: string, authData: AuthUpdateInput) {
    return prisma.auth.update({
        where: {
            userRefID: userRefID,
        },
        data: authData,
    });
}

export function updateUserByAuthId(authId: string, userData: UserUpdateInput) {
    return prisma.user.updateMany({
        where: {
            authId: authId,
        },
        data: userData,
    });
}

export function updateAuthByAuthId(authId: string, authData: AuthUpdateInput) {
    return prisma.auth.updateMany({
        where: {
            authId: authId,
        },
        data: authData,
    });
}

export function deleteUserByRefID(userRefID: string) {
    return prisma.user.delete({
        where: {
            userRefID: userRefID,
        },
    });
}

export function deleteAuthByUserRefID(userRefID: string) {
    return prisma.auth.delete({
        where: {
            userRefID: userRefID,
        },
    });
}

export function deleteUserByAuthId(authId: string) {
    return prisma.user.deleteMany({
        where: {
            authId: authId,
        },
    });
}

export function deleteAuthByAuthId(authId: string) {
    return prisma.auth.deleteMany({
        where: {
            authId: authId,
        },
    });
}

export function getAllAuthsAfter(date: Date) {
    return prisma.auth.findMany({
        where: {
            createdAt: {
                gt: date,
            },
        },
        include: {
            users: true,
        }
    });
}

export function getAuthById(authId: string) {
    return prisma.auth.findUnique({
        where: {
            authId: authId,
        },
        include: {
            users: true,
        }
    });
}

export function createAuthCongregate(
    authData: AuthCreateInput,
    userData: Omit<UserCreateInput, 'authId' | 'userRefID'>,
    userNumber: string,
) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const auth = await tx.auth.create({
            data: authData,
        });

        const user = await tx.user.create({
            data: {
                ...userData,
                authId: auth.authId,
                userRefID: `${auth.authId}@${userNumber}`,
            },
        });

        return { auth, user };
    });
}
//transactionClient to inaczej typ,który reprezentuje klienta transakcji Prisma,czyli obiekt, który umożliwia wykonywanie operacji na bazie danych w ramach jednej transakcji.
export function updateAuthCongregate(authId: string, authData: AuthUpdateInput, userRefData: UserUpdateInput) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const auth = await tx.auth.update({
            where: {
                authId: authId,
            },
            data: authData,
        });

        const user = await tx.user.updateMany({
            where: {
                authId: authId,
            },
            data: userRefData,
        });

        return { auth, user };
    });
}

export function deleteAuthCongregate(authId: string) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const user = await tx.user.deleteMany({
            where: {
                authId: authId,
            },
        });

        const auth = await tx.auth.deleteMany({
            where: {
                authId: authId,
            },
        });

        return { auth, user };
    });
}

export function indicateAuthCongregate(authId: string) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const auth = await tx.auth.findUnique({
            where: {
                authId: authId,
            },
            include: {
                users: true,
            },
        });

        return { auth };
    });
}