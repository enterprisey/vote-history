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

            // Strip struck stuff (it only confuses the parser)
            pageText = pageText.replace( /<s>[\s\S]+?<\/s>/g, function ( match ) {

                /*
                 * If we're striking stuff longer than 50 chars, it's
                 * probably a malformed tag (left unclosed, maybe)
                 */
                return match.length < 50 ? "" : match;
            } );

            // Strip <ins> tags, because they confuse the parser too
            pageText = pageText.replace( /<ins>([\s\S]+?)<\/ins>/g, "$1" );

            // Numbered comments get their section header prepended and bolded
            if( ( /=====Support=====/ ).test( pageText ) || ( /^'''Support'''$/mg ).test( pageText ) ) {
                var pageTextLines = pageText.split( "\n" );
                var currentSection;
                var HEADER_REGEX = /=====Support=====/.test( pageText )
                    ? ( /^=====\s*([\w ]+?)\s*=====$/ )
                    : /^'''(\w+?)'''$/;
                var WEAK_HEADER_REGEX = new RegExp( HEADER_REGEX.source, "m" );
                var VOTE_REGEX = /^#\s*([\s\S]+\(UTC\).*?)$/;
                var genCommentsIndex = null;
                for( var i = 0; i < pageTextLines.length; i++ ) {
                    var m = HEADER_REGEX.exec( pageTextLines[i].trim() );
                    if( m && m[1] ) {
                        if( m[1] == "Support" ||
                            m[1] == "Oppose" ||
                            m[1] == "Neutral" ) {
                            currentSection = m[1];
                        } else {
                            if( ( currentSection == "Neutral" ) && ( m[1] == "General comments" ) ) {
                                genCommentsIndex = i;
                            }
                            currentSection = '';
                        }
                    } else {
                        if( !currentSection ) continue;
                        var m2 = VOTE_REGEX.exec( pageTextLines[i] );

                        function isVoteEligible( vote ) {
                            /*
                             * Tests if a text segment (representing
                             * the main part of a vote, no leading #)
                             * is okay but with the wrong text bolded
                             * at the front.
                             */
                            return vote &&
                                !vote.startsWith( "#" ) &&
                                !vote.startsWith( ":" ) &&
                                !vote.startsWith( "*" ) &&
                                !vote.startsWith( "'''" + currentSection + "'''" );
                        }
                        if( m2 && isVoteEligible( m2[1] ) ) {
                            pageTextLines[i] = "#'''" + currentSection + "'''" + m2[1];
                        } else if( i < pageTextLines.length - 1 ) {

                            // Vote might be spread over multiple lines, so hunt for a signature
                            var j;
                            for( j = i + 1; j < pageTextLines.length; j++ ) {
                                if( /\(UTC\)[^\n]*?$/.test( pageTextLines[j] ) ) {
                                    break;
                                } else if( j - i > 10 ) {

                                    // A 10-line vote is just extravagant
                                    // Set j to an illegal value as a flag
                                    j = -1;
                                    break;
                                }
                            }
                            if( j > -1 ) {
                                var newSearchText = pageTextLines.slice( i, j + 1 ).join( "\n" );
                                var newM2 = VOTE_REGEX.exec( newSearchText );
                                if( newM2 && isVoteEligible( newM2[1] ) && !WEAK_HEADER_REGEX.test( newM2[1] ) ) {
                                    pageTextLines[i] = "#'''" + currentSection + "'''" + newM2[1].split( "\n" )[0];
                                }
                            }
                        }
                    }
                }
                var endLineIndex = genCommentsIndex ? genCommentsIndex : pageTextLines.length - 1;
                pageText = pageTextLines.slice( 0, endLineIndex ).join( "\n" );
            }

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

if( typeof module === typeof {} ) module.exports = VoteHistorySpecialCases;
