import { Prisma, PrismaClient } from '@prisma/client';
import * as CryptoJs from 'crypto-js';

const prisma = new PrismaClient();

type AuthCreateInput = {
    userAuthID: number;
    Name: string;
    email: string;
    userRefID: string;
    encryptionKey: string;
    userId: string;
};

type AuthUpdateInput = Partial<Omit<AuthCreateInput, 'userId'>>;

type UserCreateInput = {
    userName: string;
    Surname: string;
    email: string;
    password: string;
    userRefID: string;
    encryptionKey?: string;
};

type UserUpdateInput = Partial<UserCreateInput>;//partial pozwala na aktualizację tylko wybranych pól

// Model DataAuth szyfruje Name i email (AES) kluczem zapisanym w encryptionKey
function decryptAES(cipherText: string, key: string): string {
    try {
        return CryptoJs.AES.decrypt(cipherText, key).toString(CryptoJs.enc.Utf8);
    } catch {
        return '';
    }
}

// Pre-save hook zapisuje Name wielkimi literami, a email małymi, więc porównujemy w tej samej postaci
function matchesEmail(auth: { email: string; encryptionKey: string }, email: string): boolean {
    const decrypted = decryptAES(auth.email, auth.encryptionKey);
    return decrypted.length > 0 && decrypted.toLowerCase() === email.toLowerCase();
}

function matchesName(auth: { Name: string; encryptionKey: string }, name: string): boolean {
    const decrypted = decryptAES(auth.Name, auth.encryptionKey);
    return decrypted.length > 0 && decrypted.toUpperCase() === name.toUpperCase();
}

// Prisma ignoruje pola undefined, więc do update trafiają tylko przekazane wartości
function buildAuthUpdate(authData: AuthUpdateInput): Prisma.DataAuthUncheckedUpdateInput {
    return {
        userAuthID: authData.userAuthID,
        Name: authData.Name,
        email: authData.email,
        userRefID: authData.userRefID,
        encryptionKey: authData.encryptionKey,
    };
}

function buildUserCreate(userData: UserCreateInput): Prisma.UserCreateInput {//tworzy obiekt do tworzenia użytkownika w Prisma,aby uniknąć bezpośredniego przekazywania danych wejściowych
    return {
        userName: userData.userName,
        Surname: userData.Surname,
        email: userData.email,
        password: userData.password,
        userRefID: userData.userRefID,
        encryptionKey: userData.encryptionKey,
    };
}

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
    const dataAuth = await prisma.dataAuth.findUnique({
        where: { userRefID }
    });

    return dataAuth !== null && matchesEmail(dataAuth, providedEmail);
}

export async function verifyInputName(
    userRefID: string,
    providedName: string
): Promise<boolean> {
    const dataAuth = await prisma.dataAuth.findUnique({
        where: { userRefID }
    });

    return dataAuth !== null && matchesName(dataAuth, providedName);
}

export function getAllUsers() {
    return prisma.user.findMany();
}

export function getAllDataAuths() {
    return prisma.dataAuth.findMany();
}

export function getUserByRefID(userRefID: string) {
    return prisma.user.findUnique({
        where: { userRefID }
    });
}

export function getDataAuthByUserRefID(userRefID: string) {
    return prisma.dataAuth.findUnique({
        where: { userRefID }
    });
}

export function getUserById(id: string) {
    return prisma.user.findUnique({
        where: { id }
    });
}

export function getDataAuthById(id: string) {
    return prisma.dataAuth.findUnique({
        where: { id }
    });
}

// Email w DataAuth jest zaszyfrowany losowym kluczem, więc nie da się go filtrować w bazie
export async function getDataAuthByEmail(email: string) {
    const auths = await prisma.dataAuth.findMany({
        include: {
            user: true
        }
    });

    return auths.find(auth => matchesEmail(auth, email)) ?? null;
}

export async function getUserByEmail(email: string) {
    const auth = await getDataAuthByEmail(email);

    if (!auth) {
        return null;
    }

    return prisma.user.findUnique({
        where: { id: auth.userId },
        include: {
            dataAuthById: true
        }
    });
}

export async function findUserByIdentifier(identifier: string) {
    const user = await prisma.user.findUnique({
        where: { userRefID: identifier },
        include: {
            dataAuthById: true
        }
    });

    return user ?? getUserByEmail(identifier);
}

export async function findDataAuthByIdentifier(identifier: string) {
    const dataAuth = await prisma.dataAuth.findUnique({
        where: { userRefID: identifier },
        include: {
            user: true
        }
    });

    return dataAuth ?? getDataAuthByEmail(identifier);
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

export function indicateUserCongregate(userRefID: string) {
    return prisma.user.findUnique({
        where: { userRefID },
        include: {
            dataAuthById: true
        }
    });
}

export function createUser(data: UserCreateInput) {
    return prisma.user.create({
        data: buildUserCreate(data),
        include: {
            dataAuthById: true
        }
    });
}

export function createDataAuth(data: AuthCreateInput) {
    return prisma.dataAuth.create({
        data: {
            userAuthID: data.userAuthID,
            Name: data.Name,
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
            dataAuthById: true
        }
    });
}

export function updateDataAuthByUserRefID(
    userRefID: string,
    authData: AuthUpdateInput
) {
    return prisma.dataAuth.update({
        where: { userRefID },
        data: buildAuthUpdate(authData),
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

export function createUserCongregate(
    userData: UserCreateInput,
    authData: Omit<AuthCreateInput, 'userId'>
) {
    return prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
            const user = await tx.user.create({
                data: buildUserCreate(userData)
            });

            const dataAuth = await tx.dataAuth.create({
                data: {
                    userAuthID: authData.userAuthID,
                    Name: authData.Name,
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

export function updateUserCongregate(
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
                data: buildAuthUpdate(authData)
            });

            return {
                user,
                dataAuth
            };
        }
    );
}

export function deleteUserCongregate(userRefID: string) {
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
