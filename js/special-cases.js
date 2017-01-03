/* exported VoteHistorySpecialCases */
var VoteHistorySpecialCases = {
    functions: {
        "Wikipedia:Articles for deletion/": function ( pageText ) {

            // Everything after the timestamp of the nom statement.
            var TIMESTAMP_REGEX = /\d\d:\d\d,\s\d\d\s\w+\s\d\d\d\d\s\(UTC\)/;
            var afterFirstHeader = pageText.substr( pageText.indexOf( "===" ) + 1 );
            var nomStatementTimestampMatch = TIMESTAMP_REGEX.exec( afterFirstHeader );
            if( nomStatementTimestampMatch ) {
                pageText = pageText.substr( nomStatementTimestampMatch.index );
            }
            return pageText;
        },
        "Wikipedia:Templates for discussion/Log/": this.tfd,
        "Wikipedia:Categories for discussion/Log/": this.cfd,
        "Wikipeda:Redirects for discussion/Log/": this.rfd,
        "Wikipedia:Miscellany for deletion": this.mfd,
        "Wikipedia:Requests for adminship/": function ( pageText ) {
            var result;
            if ( pageText.match( /=====Support=====/ ) ) {
                result = pageText
                    .match( /=====Support=====[\S\s]+/ )[0]
                    .replace( /=====Support=====/, "" )
                    .replace( /=====Oppose=====/, "" )
                    .replace( /=====Neutral=====/, "" );
                return result;
            } else {
                result = pageText
                    .match( /====Discussion====[\S\s]+/ )[ 0 ]
                    .replace( /====Discussion====/, "" );
                return result;
            }
        },
        "Wikipedia:Requests for bureaucratship/": this.rfb
    },
    getFunction: function ( title ) {

        // Get relevant special-case function
        var result = undefined;
        Object.keys( this.functions ).forEach( function ( prefix ) {
            if ( title.startsWith( prefix ) ) {
                result = this.functions[ prefix ];
            }
        }, this );
        return result;
    },
    check: function ( title ) {

        // Do I have a function for this sort of page?
        return !!this.getFunction( title );
    }
};
