export interface UserInfo {
  name: string;
  [key: string]: any;
}

export default (initialState: UserInfo) => {
  const canSeeAdmin = !!(
    initialState && initialState.name !== 'dontHaveAccess'
  );
  return {
    canSeeAdmin,
  };
};