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

            // Numbered comments get their section header prepended and bolded
            var pageTextLines = pageText.split( "\n" );
            var currentSection;
            var HEADER_REGEX = /(?:'''|=====)\s*([\w\s]+)\s*(?:'''|=====)/;
            var VOTE_REGEX = /^#\s*([\s\S]+\(UTC\))$/;
            for( var i = 0; i < pageTextLines.length; i++ ) {
                var m = HEADER_REGEX.exec( pageTextLines[i] );
                if( m && m[1] &&
                    ( m[1] == "Support" ||
                      m[1] == "Oppose" ||
                      m[1] == "Neutral" ) ) {
                    currentSection = m[1];
                } else {
                    if( !currentSection ) continue;
                    var m2 = VOTE_REGEX.exec( pageTextLines[i] );
                    if( m2 &&
                        m2[1] &&
                        !m2[1].startsWith( "#" ) &&
                        !m2[1].startsWith( ":" ) &&
                        !m2[1].startsWith( "*" ) &&
                        !m2[1].startsWith( "'''" + currentSection + "'''" ) ) {
                        pageTextLines[i] = "#'''" + currentSection + "'''" + m2[1];
                    }
                }
            }
            pageText = pageTextLines.join( "\n" );

            // Strip headers
            if( pageText.match( /=====Support=====/ ) ) {
                pageText = pageText
                    .match( /=====Support=====[\S\s]+/ )[0]
                    .replace( /=====Support=====/, "" )
                    .replace( /=====Oppose=====/, "" )
                    .replace( /=====Neutral=====/, "" );
            } else if( pageText.match( /====Discussion====/ ) ) {
                pageText = pageText
                    .match( /====Discussion====[\S\s]+/ )[ 0 ]
                    .replace( /====Discussion====/, "" );
            } else if( pageText.match( /'''Discussion'''/ ) ) {
                pageText = pageText
                    .match( /'''Support'''[\S\s]+/ )[0]
                    .replace( /'''Support'''/, "" )
                    .replace( /'''Oppose'''/, "" )
                    .replace( /'''Neutral'''/, "" );
            }
            return pageText;
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
