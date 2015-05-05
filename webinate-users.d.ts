﻿declare module "webinate-users" {

	import mongodb = require("mongodb");
	import http = require("http");
	import validator = require("validator");
	import bcrypt = require("bcrypt-nodejs");
	import recaptcha = require("recaptcha-async");
	import nodemailer = require('nodemailer');

	/*
	* Describes what kind of privileges the user has
	*/
	export enum UserPrivileges
	{
		SuperAdmin = 1,
		Admin = 2,
		Regular = 3
	}

	/*
	* An interface to describe the data stored in the database for users
	*/
	export interface IUserEntry
	{
		_id?: mongodb.ObjectID;
		username: string;
		email: string;
		password: string;
		registerKey?: string;
		sessionId?: string;
		lastLoggedIn?: number;
		privileges?: UserPrivileges;
	}

	/*
	* Represents the details of the admin user
	*/
	export interface IAdminUser
	{
		username: string;
		email: string;
		password: string;
	}

	/*
	* Options for configuring the API
	*/
	export interface IConfig
	{
		/*
		* If set, the session will be restricted to URLs underneath the given path.
		* By default the path is "/", which means that the same sessions will be shared across the entire domain.
		*/
		sessionPath?: string;

		/**  
		* If present, the cookie (and hence the session) will apply to the given domain, including any subdomains.
		* For example, on a request from foo.example.org, if the domain is set to '.example.org', then this session will persist across any subdomain of example.org.
		* By default, the domain is not set, and the session will only be visible to other requests that exactly match the domain.
		*/
		sessionDomain?: string;

		/**
		* A persistent connection is one that will last after the user closes the window and visits the site again (true).
		* A non-persistent that will forget the user once the window is closed (false)
		*/
		sessionPersistent?: boolean;

		/**  
		* Set this to true if you are using SSL
		*/
		secure?: boolean;

		/**
		* The default length of user sessions in seconds
		*/
		sessionLifetime?: number;

		/**
		* The private key to use for Google captcha 
		* Get your key from the captcha admin: https://www.google.com/recaptcha/intro/index.html
		*/
		captchaPrivateKey: string;

		/**
		* The public key to use for Google captcha 
		* Get your key from the captcha admin: https://www.google.com/recaptcha/intro/index.html
		*/
		captchaPublicKey: string;

		/**
		* The domain or host of the site
		*/
		host: string;

		/**
		* The port number to operate under
		*/
		port: number;

		/**
		* The email of the admin account
		*/
		emailAdmin: string;

		/**
		* The 'from' email when notifying users
		*/
		emailFrom: string;

		/**
		* Email service we are using to send mail. For example 'Gmail'
		*/
		emailService: string;

		/**
		* The email address / username of the service
		*/
		emailServiceUser: string;

		/**
		* The password of the email service
		*/
		emailServicePassword: string;

		/**
		* This is the relative URL that the registration link sends to the user when clicking to activate their account.
		* An example might be 'api/activate-account'
		* This will be sent out as http(s)://HOST:PORT/activationURL?[Additional details]
		*/
		activationURL: string;

		/**
		* The administrative user
		*/
		adminUser: IAdminUser;
	}

	/*
	* Class that represents a user and its database entry
	*/
	export class User
	{
		dbEntry: IUserEntry;

		/**
		* Creates a new User instance
		* @param {IUserEntry} dbEntry The data object that represents the user in the DB
		*/
		constructor(dbEntry: IUserEntry);

		/**
		* Generates the object to be stored in the database
		* @returns {IUserEntry}
		*/
		generateDbEntry(): IUserEntry;

		/**
		* Creates a random string that is assigned to the dbEntry registration key
		* @param {number} length The length of the password
		* @returns {string}
		*/
		generateRegistrationKey(length: number): string
	}

	/**
	* Main class to use for managing users
	*/
	export class UserManager
	{
		/**
		* Creates an instance of the user manager
		* @param {mongodb.Collection} userCollection The mongo collection that stores the users
		* @param {mongodb.Collection} sessionCollection The mongo collection that stores the session data
		* @param {IConfig} The config options of this manager
		*/
		constructor(userCollection: mongodb.Collection, sessionCollection: mongodb.Collection, config: IConfig);

		/** 
		* Initializes the API
		* @returns {Promise<void>}
		*/
		initialize(): Promise<void>

		/** 
		* Attempts to register a new user
		* @param {string} username The username of the user
		* @param {string} pass The users secret password
		* @param {string} email The users email address
		* @param {string} captcha The captcha value the user guessed
		* @param {string} captchaChallenge The captcha challenge
		* @param {http.ServerRequest} request 
		* @param {http.ServerResponse} response
		* @returns {Promise<User>}
		*/
		register(username: string, pass: string, email: string, captcha: string, captchaChallenge: string, request?: http.ServerRequest, response?: http.ServerResponse): Promise<User>;

		/**
		* Creates a new user
		* @param {string} user The unique username
		* @param {string} email The unique email
		* @param {string} password The password for the user
		* @param {UserPrivileges} privilege The type of privileges the user has. Defaults to regular
		* @returns {Promise<User>}
		*/
		createUser(user: string, email: string, password: string, privilege: UserPrivileges): Promise<User>

		/** 
		* Attempts to resend the activation link
		* @param {string} username The username of the user
		* @returns {Promise<boolean>}
		*/
		resendActivation(username: string): Promise<boolean>;

		/** 
		* Checks the users activation code to see if its valid
		* @param {string} username The username of the user
		* @returns {Promise<boolean>}
		*/
		checkActivation(username: string, code: string): Promise<boolean>;

		/**
		* Checks to see if a user is logged in
		* @param {http.ServerRequest} request 
		* @param {http.ServerResponse} response
		* @param {Promise<User>} Gets the user or null if the user is not logged in
		*/
		loggedIn(request: http.ServerRequest, response: http.ServerResponse): Promise<User>;

		/**
		* Attempts to log the user out
		* @param {http.ServerRequest} request 
		* @param {http.ServerResponse} response
		* @returns {Promise<boolean>}
		*/
		logOut(request: http.ServerRequest, response?: http.ServerResponse): Promise<boolean>;

		/**
		* Gets a user by a username or email
		* @param {user : string} user The username or email of the user to get
		* @returns {Promise<User>}
		*/
		getUser(user: string): Promise<User>;

		/**
		* Attempts to log a user in
		* @param {string} username The username or email of the user
		* @param {string} pass The password of the user
		* @param {boolean} rememberMe True if the cookie persistence is required
		* @param {http.ServerRequest} request 
		* @param {http.ServerResponse} response
		* @returns {Promise<User>}
		*/
		logIn(username: string, pass: string, rememberMe: boolean, request?: http.ServerRequest, response?: http.ServerResponse): Promise<User>;

		/**
		* Removes a user by his email or username
		* @param {string} username The username or email of the user
		* @param {http.ServerRequest} request 
		* @param {http.ServerResponse} response
		* @returns {Promise<boolean>} True if the user was in the DB or false if they were not
		*/
		remove(username: string, request?: http.ServerRequest, response?: http.ServerResponse): Promise<boolean>;

		/** 
		* Prints user objects from the database
		* @param {number} limit The number of users to fetch
		* @param {number} startIndex The starting index from where we are fetching users from
		* @returns {Promise<Array<User>>}
		*/
		getUsers(startIndex: number, limit: number): Promise<Array<User>>;
	}
}