"use strict";

import * as google from "googleapis";
import * as googleAuth from "google-auth-library";
import * as fs from "fs";
import * as winston from "winston";
import * as def from "webinate-users";

/**
 * A simple class for sending mail using Google Mail's API
 */
export class GMailer implements def.IMailer {
    public gmail: google.GMail;
    private _keyFile: any;
    private _apiEmail: string;
    private _authorizer: any;
    private _scopes: Array<string>;
    private _debugMode: boolean;

    /**
     * Creates an instance of the mailer
     */
    constructor( debugMode: boolean ) {
        this._debugMode = debugMode;
        this._scopes = [
            'https://mail.google.com/',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/gmail.compose',
            'https://www.googleapis.com/auth/gmail.send'
        ];
    }

    /**
     * Attempts to initialize the mailer
     * @param options The gmail options for this mailer
     */
    initialize( options: def.IGMail ): Promise<boolean> {
        var that = this;
        return new Promise( function( resolve ) {

            that.gmail = google.gmail( 'v1' );
            that._keyFile = JSON.parse( fs.readFileSync( options.keyFile, "utf8" ) );
            that._apiEmail = options.apiEmail;

            // Authorize a client with the loaded credentials
            that.authorize( that._keyFile )
                .then( function() {
                    winston.info( `Connected to Google Authentication`, { process: process.pid });
                    resolve( true )
                })
                .catch( function( err: Error ) {
                    winston.error( `Could not authorize Google API: ${err.message}`, { process: process.pid });
                    resolve( false );
                });
        });
    }

    /**
     * Attempts to authorize the google service account credentials
     */
    private authorize( credentials ): Promise<GoogleAuth.JWT> {
        var that = this;

        return new Promise<GoogleAuth.JWT>( function( resolve, reject ) {

            var auth = new googleAuth();
            var jwt = new auth.JWT(
                credentials.client_email,
                null,
                credentials.private_key,
                that._scopes,
                that._apiEmail
            );

            jwt.authorize( function( err ) {

                if ( err )
                    return reject( err );

                that._authorizer = jwt;
                resolve( jwt );
            });
        });
    }

    /**
     * Sends an email using Google's Gmail API
     * @param to The email address to send the message to
     * @param from The email we're sending from
     * @param subject The message subject
     * @param msg The message to be sent
     */
    sendMail( to: string, from: string, subject: string, msg: string ): Promise<boolean> {
        var that = this;
        return new Promise( function( resolve, reject ) {

            winston.info( `Sending email to: ${to}`, { process: process.pid });

            // Build the message string
            var message = that.buildMessage( to, from, subject, msg );

            if ( that._debugMode )
                return resolve( true );

            winston.info( `Sending: ${message}`, { process: process.pid });

            // Send the message
            that.gmail.users.messages.insert( {
                auth: that._authorizer,
                userId: 'me',
                resource: { raw: message }
            }, function( err, response ) {

                if ( err ) {
                    winston.error( `Could not send email to ${to}: ${err}`, { process: process.pid });
                    return reject( err );
                }

                // See explanation on next line
                if ( that._apiEmail != to ) {
                    winston.info( `Email sent ${JSON.stringify( response )} unmodified`, { process: process.pid });
                    return resolve( true );
                }

                // When you send an email to yourself - it doesnt go to the inbox in gmail.
                // You actually have to modify the sent email labels to tell it to do so.
                // Sending to other emails is fine though
                that.gmail.users.messages.modify( {
                    auth: that._authorizer,
                    userId: 'me',
                    id: response.id,
                    resource: { addLabelIds: [ 'UNREAD', 'INBOX', 'IMPORTANT' ] }
                }, function( err ) {
                    if ( !err ) {
                        winston.info( `Modified email sent ${JSON.stringify( response )}`, { process: process.pid });
                        return resolve( true );
                    }
                    else {
                        winston.error( `Could not modify email ${JSON.stringify( response )}: ${err}`, { process: process.pid });
                        return reject( err );
                    }
                });
            });
        });
    }

    /**
     * Builds a message string in base64 encoding
     * @param to The email address to send the message to
     * @param from The email we're sending from
     * @param subject The message subject
     * @param message The message to be sent
     */
    private buildMessage( to: string, from: string, subject: string, message: string ): string {
        var str = [ "Content-Type: text/plain; charset=\"UTF-8\"\r\n",
            "MIME-Version: 1.0\r\n",
            "Content-Transfer-Encoding: 7bit\r\n",
            "to: ", to, "\r\n",
            "from: ", from, "\r\n",
            "subject: ", subject, "\r\n\r\n",
            message
        ].join( '' );

        // Encode the mail into base 64
        var encodedMail = new Buffer( str ).toString( "base64" ).replace( /\+/g, '-' ).replace( /\//g, '_' );
        return encodedMail;
    }
}