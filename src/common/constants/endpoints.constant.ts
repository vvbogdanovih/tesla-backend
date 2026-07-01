export const ENDPOINTS = {
	HEALTH: {
		BASE: '/health'
	},
	AUTH: {
		BASE: '/auth',
		REGISTER: '/register',
		LOGIN: '/login',
		REFRESH: '/refresh',
		LOGOUT: '/logout',
		ME: '/me',
		FORGOT_PASSWORD: '/forgot-password',
		RESET_PASSWORD: '/reset-password'
	},
	USERS: {
		BASE: '/users',
		GET_ALL: '/',
		GET_BY_ID: '/:id',
		UPDATE: '/:id'
	},
	ACCOUNT: {
		BASE: '/account',
		PROFILE: '/profile',
		ADDRESSES: '/addresses',
		ORDERS: '/orders'
	},
	PRODUCTS: {
		BASE: '/products',
		GET_ALL: '/',
		SEARCH: '/search',
		BY_SLUG: '/by-slug/:slug',
		GET_BY_ID: '/:id',
		CREATE: '/',
		UPDATE: '/:id',
		DELETE: '/:id'
	},
	CARS: {
		BASE: '/cars',
		GET_ALL: '/',
		CREATE: '/',
		UPDATE: '/:id',
		DELETE: '/:id'
	},
	CATEGORIES: {
		BASE: '/categories',
		GET_ALL: '/',
		PRODUCTS: '/:slug/products',
		CREATE: '/',
		UPDATE: '/:id',
		DELETE: '/:id'
	},
	CART: {
		BASE: '/cart'
	},
	ORDERS: {
		BASE: '/orders',
		CREATE: '/',
		GET_BY_ID: '/:id',
		UPDATE_STATUS: '/:id/status'
	},
	WISHLIST: {
		BASE: '/account/wishlist',
		LIST: '/',
		TOGGLE: '/:productId',
		ADMIN: '/admin/wishlist'
	},
	LEADS: {
		BASE: '/leads',
		CREATE: '/',
		GET_ALL: '/',
		PRICE_MATCH: '/price-match',
		PRICE_SUBSCRIBE: '/price-subscribe'
	},
	BLOG: {
		BASE: '/blog',
		GET_ALL: '/',
		BY_SLUG: '/:slug'
	},
	BANNERS: {
		BASE: '/banners'
	},
	NOVA_POSHTA: {
		BASE: '/delivery/np',
		CITIES: '/cities',
		WAREHOUSES: '/warehouses'
	}
} as const
