export default {};
export const hash = () => Promise.resolve('');
export const verify = () => Promise.resolve(true);
export const Scrypt = function() {
    this.hash = () => Promise.resolve('');
    this.verify = () => Promise.resolve(true);
};
export const drizzle = () => ({
    select: () => ({ from: () => ({ where: () => ({ get: () => Promise.resolve({}), all: () => Promise.resolve([]) }) }) }),
    insert: () => ({ values: () => ({ onConflictDoNothing: () => Promise.resolve({}), returning: () => ({ get: () => Promise.resolve({}) }) }) }),
});
export const sql = () => ({});
