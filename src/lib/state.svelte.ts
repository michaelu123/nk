import { getContext, setContext } from 'svelte';

export interface UserStateProps {
	showNav: boolean;
}

export class UserState implements UserStateProps {
	showNav = $state(false);

	constructor(data: UserStateProps) {
		console.log('UserState constructor');
		this.updateState(data);
	}

	updateState(data: UserStateProps) {
		this.showNav = data.showNav;
	}
}

const USER_STATE_KEY = Symbol('USER_STATE');

export function setUserState(data: UserStateProps) {
	return setContext(USER_STATE_KEY, new UserState(data));
}

export function getUserState() {
	return getContext<UserState>(USER_STATE_KEY);
}

export let showNav = $state({ value: false });
