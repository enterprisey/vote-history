/* jshint moz: true */
/* global VoteHistorySpecialCases, moment */
const SERVER = "https://en.wikipedia.org/";
const API_ROOT = SERVER + "/w/api.php",
      API_OPTIONS = "action=query&prop=revisions&rvprop=content&format=jsonfm",
      API_SUFFIX = "&format=json&callback=?&continue=";

const SECTION_HEADER_KEYWORDS = ["support", "oppose", "neutral", "yes", "no"];

function makeWikiLink( pageTitle ) {
    return $( "<a> " )
             .attr( "href", "https://en.wikipedia.org/wiki/" + encodeURIComponent( pageTitle ) )
             .attr( "title", pageTitle + " on the English Wikipedia" )
             .text( pageTitle );
}

function getPageText( pageTitle ) {
    var apiUrl = API_ROOT + "?" + API_OPTIONS + "&titles=" + encodeURIComponent( pageTitle ) + API_SUFFIX;
    var deferred = $.Deferred();
    $.getJSON( apiUrl )
        .done( function ( data ) {
            var pageid = Object.getOwnPropertyNames( data.query.pages )[0];
            if ( data.query.pages[ pageid ].hasOwnProperty( "missing" ) ) {
                deferred.reject( "missing" );
            } else {
                deferred.resolve( data.query.pages[ pageid ].revisions[0]["*"] );
            }
        } ).fail( function ( e ) {
            deferred.reject( e );
        } );
    return deferred;
}

function showSuggestions() {
    $( "#suggestions" ).hide();
    $.when(
        getPageText( "Wikipedia:Requests for adminship/Recent" ),
        $.get( "https://en.wikipedia.org/api/rest_v1/page/html/Template%3ARFX_report" ),
    ).done( function ( pageText, reportResult ) {
        var reportHtml = reportResult[0];
        var rfxMatches = reportHtml.match(/Wikipedia:Requests for adminship\/.+?"/);
        var currentRfXs = (rfxMatches || []).map( function ( matchText ) {
            return matchText.substring( 0, matchText.length - 1 );
        } );
        var mostRecentRfAs = pageText.match(/{{[Rr]ecent RfX\|A\|([^|]+)\|\d*\|/g).slice(0, 2).map( function ( matchText ) {
            return "Wikipedia:Requests for adminship/" + matchText.replace( /{{[Rr]ecent RfX\|A\|/, "" ).replace( /\|/g, " " ).trim();
        } );
        $( "#suggestions ul" ).empty();
        ( currentRfXs.concat( mostRecentRfAs ).concat( [ "Wikipedia:Village pump (proposals)" ] ) ).forEach( function ( pageName ) {
            $( "#suggestions ul" )
                .append( $( "<li>" ).append( $( "<a>" )
                         .attr( "href", "#" )
                         .text( pageName )
                         .click( function () {
                             $( "#page" ).val( pageName );
                             $( "#submit" ).trigger( "click" );
                             $( "#suggestions" ).fadeOut();
                         } ) ) );
        } );
        $( "#suggestions" ).fadeIn();
    } );
}

function listDiscussions() {
    var pageTitle = $( "#page" ).val().trim();
    $( "#error" ).hide();
    $( "#discussions" ).hide();
    $( "#analysis" ).hide();
    if ( pageTitle === "" ) {
        $( "#error" ).empty();
        $( "#error" ).show();
        $( "#error" ).append( $( "<div>" )
                              .addClass( "errorbox" )
                              .text( "No page specified." ) );
        showSuggestions();
        return;
    }

    $( "#discussions" ).show();
    if( document.getElementById( "loading" ) ) {

        // If we're already loading, don't make another API call
        return;
    }

    $( "#discussions" )
        .append( $( "<div> " )
                 .attr( "id", "loading" )
                 .append( $( "<img>" )
                          .attr( "src", "images/loading.gif" ) )
                 .append( "Loading..." ) );

    // Preprocess title

    // Replace aliases ([[WP:ALIAS]])
    pageTitle = preprocessPageTitle( pageTitle );

    getPageText( pageTitle ).done( function ( pageText ) {
        $( "#discussions" ).empty();

        // Generate and display permalink
        // We want what's in the address bar without the ?=___ or #___ stuff
        var permalinkSubstringMatch = /[\#\?]/.exec(window.location.href);
        var permalink = window.location.href;
        if( permalinkSubstringMatch ) {
            permalink = window.location.href.substring( 0, permalinkSubstringMatch.index );
        }
        permalink += "?page=" + encodeURIComponent( pageTitle );
        $( "#discussions" ).append( $( "<p>" )
                                    .addClass( "permalink" )
                                    .append( "(" )
                                    .append( $( "<a>" )
                                             .attr( "href", permalink )
                                             .text( "permalink" ) )
                                    .append( " to these results)" ) );

        var sectionHeaders = pageText.match( /==+.+?==+/g );
        if ( VoteHistorySpecialCases.check( pageTitle ) ) {
            $( "#discussions" ).append( $( "<div>" )
                                        .addClass( "successbox" )
                                        .text( "Special discussion page detected at " )
                                        .append( makeWikiLink( pageTitle ) )
                                        .append( "." ) );
            var discussionAnalysis = analyzeDiscussion( VoteHistorySpecialCases.getFunction( pageTitle )( pageText ),
                                                        pageTitle );
            var showSupportPercentageGraph = pageTitle.startsWith( "Wikipedia:Requests for adminship/" ) ||
                    pageTitle.startsWith( "Wikipedia:Requests for bureaucratship/" );
            var rfxType = pageTitle.startsWith( "Wikipedia:Requests for adminship/" ) ? "rfa" : "rfb";
            displayDiscussionAnalysis( discussionAnalysis,
                    {
                      "showSupportPercentageGraph": showSupportPercentageGraph,
                      "scrollTo": window.location.hash,
                      "rfxType": rfxType
                    } );
        } else if ( !sectionHeaders ) {
            if ( getVoteMatches( pageText ) || pageText.match( /^\*/ ) ) {
                $( "#discussions" ).append( $( "<div>" )
                                            .addClass( "successbox" )
                                            .append( "Single-discussion page detected at " )
                                            .append( makeWikiLink( pageTitle ) )
                                            .append( "." ) );
                displayDiscussionAnalysis( analyzeDiscussion( section, pageTitle ), { "scrollTo": window.location.hash } );
            } else if ( pageText.match( /^#REDIRECT\s+\[\[/i ) ) {
                var REDIR_REGEX = /#[Rr][Ee][Dd][Ii][Rr][Ee][Cc][Tt]\s+\[\[(.+)\]\]/;
                var redirMatch = REDIR_REGEX.exec( pageText );
                if( redirMatch ) {
                    $( "#discussions" ).hide();
                    $( "#error" ).empty().show();
                    $( "#error" ).append( $( "<div>" )
                                          .addClass( "warningbox" )
                                          .append( "This page appears to redirect to " + redirMatch[1] + "." )
                                          .append( $( "<a>" )
                                              .attr( "href", "#" )
                                              .click( function () {
                                                  $( "#page" ).val( redirMatch[1] );
                                                  $( "#submit" ).click();
                                              } )
                                              .text( "Try using that" ) )
                                          .append( "?" ) );
                }
            } else {
                $( "#discussions" ).hide();
                $( "#error" ).empty().show();
                $( "#error" ).append( $( "<div>" )
                                      .addClass( "errorbox" )
                                      .append( "I couldn't find any discussion headers on " )
                                      .append( makeWikiLink( pageTitle ) )
                                      .append( "." ) );
            }
        } else {
            $( "#discussions" ).append( $( "<h2>" ).text( "Discussions on " )
                                        .append( makeWikiLink( pageTitle ) ) );

            var sections = [];
            var headerRegex = /^==+.+?==+/mg;
            var res;
            while( ( res = headerRegex.exec( pageText ) ) !== null ) {
                var title = /^=+(.+?)=+\s*$/.exec( res[0] )[1].trim();
                title = title.replace(/<span.+?<\/span>/g, '');
                var text = pageText.substring( res.index );
                var endMatch = /^==+.+?==+/mg.exec( text.substring( res[0].length ) );
                if( endMatch ) {
                    text = text.substring( 0, res[0].length + endMatch.index );
                }
                for( var keywordIdx = 0; keywordIdx < SECTION_HEADER_KEYWORDS.length; keywordIdx++ ) {
                    if( new RegExp( "^" + SECTION_HEADER_KEYWORDS[keywordIdx] + "\\b" ).test( title.toLowerCase() ) ) {
                        var vote = title.substring( 0, title.indexOf(' ') >= 0 ? title.indexOf(' ') : title.length );
                        text = text.replace(/^#\s*([^'*:])/gm, "#'''" + vote + "'''  $1");
                    }
                }
                sections.push( {
                    "full": res[0],
                    "level": res[0].match( /^=+/g )[0].length,
                    "title": title.trim(),
                    "text": text
                } );
            }

            // Fold adjacent "Support", "Oppose", and "Neutral" (etc) section
            console.log(sections);
            for( var i = 0; i < sections.length; i++ ) {
                var subsectionTitles = [];
                var j = i;
                var hasKeyword = false;
                while( true ) {
                    hasKeyword = false;
                    for( var keywordIdx = 0; keywordIdx < SECTION_HEADER_KEYWORDS.length; keywordIdx++ ) {
                        if( new RegExp( "^" + SECTION_HEADER_KEYWORDS[keywordIdx] + "\\b" ).test( sections[j].title.toLowerCase() ) ) {
                            hasKeyword = true;
                        }
                    }

                    if( sections[j].level != sections[i].level || !hasKeyword ) {
                        break;
                    }

                    subsectionTitles.push( sections[j].title );
                    j++;
                }

                if( subsectionTitles.length > 1 ) {

                    // Update the metadata of the parent section with the sections we're folding
                    sections[i].subsections = subsectionTitles;
                    sections[i].title = '<' + ( subsectionTitles.length ) + ' combined sections>';

                    // merge text
                    for( var k = i + 1; k < j; k++ ) {
                        sections[i].text += sections[k].text;
                    }

                    sections.splice( i + 1, subsectionTitles.length - 1 );
                    i--;
                    continue;
                }
            }

            sections.forEach( function ( section ) {
                var votes = getVoteMatches( section.text );
                var disabledAttr = votes ? {} : { "disabled": "disabled" };
                var analyzeHandler = function () {
                    displayDiscussionAnalysis( analyzeDiscussion( section.text, pageTitle ), {
                        "scrollTo": "analysis",
                        "showSupportPercentageGraph": section.subsections && ( section.subsections.length === 2 || section.subsections.length === 3 ),
                        "rfxType": "",
                    } );
                };
                var discussionDiv = $( "<div>" )
                    .appendTo( "#discussions" )
                    .addClass( "discussion" )
                    .css( "margin-left", ( ( section.level - 2 ) * 1 ) + "em" )
                    .append( $( "<button>" )
                             .addClass( "mw-ui-button mw-ui-progressive" )
                             .addClass( "vote-history-analyze-button" )
                             .text( "Analyze >>" )
                             .attr( disabledAttr )
                             .click( analyzeHandler ) )
                    .append( $( "<b>" ).text( section.title ) )
                    .append( $( "<i>" ).text( ( !votes ? "No votes" : ( votes.length + " votes" ) ) +
                                              "; " + section.text.length + " bytes" ) );
                if( section.subsections ) {
                    discussionDiv.append( $( "<span>" ).text( "Subsections: " + section.subsections.join( ", " ) ) );
                }
            } ); // end forEach on sectionHeaders
        } // end else block
    } ).fail( function ( error ) {

        // Handle an error in getPageText()
        $( "#error" ).empty().show();
        $( "#error" ).append( $( "<div> ")
                              .addClass( "errorbox" )
                              .text( error === "missing"
                                     ? "Page doesn't exist!"
                                     : "Error while loading page text" +
                                     ( error && error.message
                                       ? ": " + error.message
                                       : "." ) ) );
        $( "#discussions" ).hide();
    } );
}; // end listDiscussions()

function preprocessPageTitle( pageTitle ) {
    return pageTitle
        .replace( /^(WP|Project):/, "Wikipedia:" )
        .replace( /^(WT|Project talk):/, "Wikipedia talk:" );
}

function getVoteMatches ( voteText ) {
    voteText = voteText.replace( /=.+?=/, "" );
    var matches = voteText.match( /^[#\*]\s*'''.+?'''[\s\S]*?(?:\[\[:?\s*(?:[Uu]ser|Special:Contributions\/).*\]\].*?\d\d:\d\d,\s+\d{1,2}\s+\w+?\s+\d\d\d\d\s+\(UTC\)|class\s*=\s*"autosigned").*$/mg );
    return matches;
}

function analyzeDiscussion ( discussionText, pageTitle ) {
    var voteMatches = getVoteMatches( discussionText );
    if ( !voteMatches ) {
        return {};
    }

    var votesByUser = {};
    var duplicateVotes = {}; // {'ExampleUser': [ some voteObjects ]}
    voteMatches.forEach( function ( voteText ) {
        var vote = voteText.match( /'''(.+?)'''/ )[1];
        var lastLine = voteText.split( "\n" ).pop();
        var timestampMatch = lastLine.match( /(\d\d:\d\d,\s+(?:\d{1,2}\s+\w+|\w+\s+\d{1,2},)\s+\d\d\d\d)\s+\(UTC\)(?!.*\(UTC\).*)/ );
        var timestamp = timestampMatch ? timestampMatch[1] : "";
        var usernameMatches = lastLine.match( /\[\[\s*[Uu]ser.*?:\s*([^\|\[\]<>\/]*?)(?:\||(?:\]\]))/g );
        var username = usernameMatches ? usernameMatches[usernameMatches.length - 1].match( /\[\[\s*[Uu]ser.*?:([^\|\[\]<>\/]*?)(?:\||(?:\]\]))/ )[1].replace( /#.*/, "" ).trim() : "";
        vote = vote
            .replace( /Obvious/i, "" )
            .replace( /Speedy/i, "" )
            .replace( /Strong/i, "" )
            .trim();
        console.assert( !!username );

        // Votes that contain the string "support" (or "oppose", etc)
        // are treated as if they consisted entirely of "support" (etc)
        [ "support", "oppose", "neutral", "keep", "delete", "merge", "yes", "no" ].forEach( function ( voteType ) {
            if ( vote.toLowerCase().indexOf( voteType ) > -1 ) {
                vote = voteType.charAt( 0 ).toUpperCase() + voteType.substring( 1 );
            }
        } );

        // All other votes are transformed from xXxXx (or whatever) to Xxxxx
        vote = vote.charAt( 0 ).toUpperCase() + vote.substr( 1 ).toLowerCase();

        // Handle both MDY and DMY
        var momentFormatString;
        var hasTwoCommas = function ( string ) {
            return /([\s\S]*,){2}/m.test( string );
        };
        if( hasTwoCommas( timestamp ) ) {
            momentFormatString = "HH:mm, MMM DD, YYYY";
        } else {
            momentFormatString = "HH:mm, DD MMM YYYY";
        }

        var voteObject = {
            "vote": vote,
            "time": moment.utc( timestamp, momentFormatString )
        };

        if( username in votesByUser ) {
            // There's a duplicate vote!
            // Record it in the list.
            if( duplicateVotes[ username ] ) {
                duplicateVotes[ username ].push( voteObject );
            } else {
                duplicateVotes[ username ] = [ votesByUser[ username ], voteObject ];
            }

            // And only count the most recent vote.
            if( voteObject.time > votesByUser[ username ].time ) {
                votesByUser[ username ] = voteObject;
            }
        } else {
            votesByUser[ username ] = voteObject;
        }
    } );

    // Convert votes into an array
    var voteObjects = Object.keys( votesByUser ).map( function ( username ) {
        return {
            vote: votesByUser[ username ].vote,
            time: votesByUser[ username ].time,
            user: username
        };
    } );

    // Comments and questions are never displayed
    voteObjects = voteObjects.filter( function ( voteObject ) {
        return ( voteObject.vote.toLowerCase().indexOf( "comment" ) === -1 ) &&
            ( voteObject.vote.toLowerCase().indexOf( "question" ) === -1 );
    } );

    // Sort in order of ascending timestamps
    voteObjects.sort( function ( a, b ) { return a.time - b.time; } );

    // {"Support": 12, "Oppose": 6, ...}
    var voteTally = {};
    voteObjects.forEach( function ( voteObject ) {
        if( voteTally.hasOwnProperty( voteObject.vote ) ) {
            voteTally[ voteObject.vote ]++;
        } else {
            voteTally[ voteObject.vote ] = 1;
        }
    } );

    var allowedVoteTypes = [];
    if( pageTitle.startsWith( "Wikipedia:Requests for adminship" ) ) {
        allowedVoteTypes = [ "Support", "Oppose", "Neutral" ];
    } else {

        // We don't want options with only one vote to show up in the table
        // But, "important" votes should always be shown, even if there's only one of them
        var is_vote_important = function () { return false; };
        if( pageTitle.startsWith( "Wikipedia:Articles for deletion/" ) ) {
            is_vote_important = function ( vote ) {
                return /(?:strong\s)?(?:keep|delete|merge)/.test( vote.toLowerCase() );
            };
        }

        // ["Support", "Oppose", ...] but w/o votes appearing only once
        allowedVoteTypes = Object.keys( voteTally ).filter( function ( vote ) {
            return voteTally[ vote ] > 1 || is_vote_important( vote );
        } );

        // If there's one "Support" or "Oppose" vote, the other type should also be shown
        if( allowedVoteTypes.indexOf( "Support" ) > -1 && allowedVoteTypes.indexOf( "Oppose" ) === -1 ) {
            allowedVoteTypes.push( "Oppose" );
        }
        if( allowedVoteTypes.indexOf( "Oppose" ) > -1 && allowedVoteTypes.indexOf( "Support" ) === -1 ) {
            allowedVoteTypes.push( "Support" );
        }
    }

    // Initialize allowed votes that aren't in the tally yet to zero
    allowedVoteTypes.forEach( function ( voteType ) {
        voteTally[ voteType ] = voteTally[ voteType ] || 0;
    } );

    // Actually filter the vote objects
    var filteredVoteObjects = voteObjects.filter( function ( voteObject ) {
        return allowedVoteTypes.indexOf( voteObject.vote ) > -1;
    } );

    var voteTypes = allowedVoteTypes;

    // Bring "Support"/"Oppose"/"Neutral" to the front in that order
    var fixedVoteTypes = [ "Support", "Oppose", "Neutral" ];
    for( var i = 0; i < fixedVoteTypes.length; i++ ) {
        var currentIndex = voteTypes.indexOf( fixedVoteTypes[ i ] );
        if( currentIndex > 0 ) {
            voteTypes[ currentIndex ] = voteTypes[ i ];
            voteTypes[ i ] = fixedVoteTypes[ i ];
        }
    }

    return {
        "voteObjects": voteObjects,
        "filteredVoteObjects": filteredVoteObjects,
        "voteTally": voteTally,
        "voteTypes": voteTypes,
        "duplicateVotes": duplicateVotes,
    };
}

/*
 * Options:
 *  - showSupportPercentageGraph (boolean) - true if the "support percentage graph" should be shown
 *  - rfxType (string) - "rfa" if it's an RfA being show, "rfb" if it's an RfB being show, undefined otherwise
 *  - scrollTo (string) - id of the element to scroll to after everything's been displayed (default is not to scroll at all)
 */
function displayDiscussionAnalysis ( discussionAnalysis, options ) {
    $( "#analysis" )
        .show()
        .empty();

    // Show the vote graph
    $( "#analysis" ).append( "<section id='vote-totals-graph'><h2>Vote totals graph</h2></section>" );
    appendVoteGraphTo( "#vote-totals-graph", discussionAnalysis.filteredVoteObjects );

    // Show support percentage table
    if( options.showSupportPercentageGraph ) {
        $( "#analysis" ).append( "<section id='support-percentage-graph'><h2>Support percentage graph</h2>" +
                                 "<input type='checkbox' id='oppose-percentage' /><label for='oppose-percentage'" +
                                 ">Show oppose instead of support percentage</label><br>" +
                                 "<input type='checkbox' id='show-full-scale' /><label for='show-full-scale'" +
                                 ">Show full percentage scale (0% to 100%)</label></section>" );
        var addSupportGraph = function () {
            appendSupportPercentageGraphTo( "#support-percentage-graph",
                    discussionAnalysis.filteredVoteObjects,
                    options.rfxType );
        };
        var recomputeGraph = function () {
            var graphSection = document.getElementById( "support-percentage-graph" );

            // Remove svg element and div with the download link
            graphSection.removeChild( graphSection.lastChild );
            graphSection.removeChild( graphSection.lastChild );
            addSupportGraph();

            // Update section header
            // Filter trick from http://stackoverflow.com/a/222847/1757964
            var h2 = [].slice.call( graphSection.children ).filter( function ( element ) { return element.tagName === "H2"; } )[0];
            h2.innerHTML = ( document.getElementById( "oppose-percentage" ).checked ? "Oppose" : "Support" ) +
                " percentage graph";
        };
        document.getElementById( "oppose-percentage" ).addEventListener( "click", recomputeGraph );
        document.getElementById( "show-full-scale" ).addEventListener( "click", recomputeGraph );
        addSupportGraph();
    }

    // Show the vote tally table
    $( "#analysis" ).append( "<section id='vote-tally'><h2>Vote tally</h2><table><tr></tr></table></section>" );
    discussionAnalysis.voteTypes.forEach( function ( voteType ) {
        $( "#vote-tally table tr" ).append( $( "<th>" ).text( voteType ) );
    } );
    $( "#vote-tally table" ).append( "<tr></tr>" );
    discussionAnalysis.voteTypes.forEach( function ( voteType ) {
        $( "#vote-tally table tr" ).last().append( $( "<td>" ).text( discussionAnalysis.voteTally[ voteType ] || 0 ) );
    } );

    if( Object.keys( discussionAnalysis.duplicateVotes ).length > 0 ) {
        $( "#analysis" ).append( "<section id='duplicate-votes'><h2>Duplicate votes</h2></section>" );
        $( "#duplicate-votes" ).append( "<p><i>Only the most recent vote was counted in the graph(s) and table.</i></p>" );
        $( "#duplicate-votes" ).append( $( "<ul>" ) );
        Object.keys( discussionAnalysis.duplicateVotes ).forEach( function ( username ) {
            var dupes = discussionAnalysis.duplicateVotes[ username ];
            $( "<li>" )
                .appendTo( "#duplicate-votes ul" )
                // note that "votes" doesn't have to be properly pluralized :)
                .text( username + " (" + dupes.length + " votes): " + dupes.map( function ( dupe ) { return dupe.vote + " on " + dupe.time.format( "HH:mm, D MMMM YYYY" ); } ).join( ", " ) );
        } );
    }

    // Start the vote list
    $( "#analysis" ).append( "<section id='vote-list'><h2>Vote list</h2></section>" );

    // Show a note...

    // ...about the sort order
    var voteListNote = "Shown in time order.";

    // ...if we filtered any votes
    var numVotesFiltered = discussionAnalysis.voteObjects.length -
        discussionAnalysis.filteredVoteObjects.length;
    if( numVotesFiltered > 0 ) {
        voteListNote += " Including " + numVotesFiltered + " singleton vote" +
            ( numVotesFiltered === 1 ? "" : "s" ) + " that " +
            ( numVotesFiltered === 1 ? "isn't" : "aren't" ) + " shown in the graph and table.";
    }
    $( "#vote-list" ).append( "<p><i>" + voteListNote + "</i></p>" );

    $( "#vote-list" ).append( $( "<ul>" ) );
    discussionAnalysis.voteObjects.forEach( function ( voteObject ) {
        $( "<li>" )
            .appendTo( "#vote-list ul" )
            .text( voteObject.vote + ", cast on " +
                   voteObject.time.format( "HH:mm, D MMMM YYYY" ) + " by " )
            .append( $( "<a>" )
                     .attr( "href", "https://en.wikipedia.org/wiki/User:" + encodeURIComponent( voteObject.user ) )
                     .text( voteObject.user ) );
    } );

    if( options.scrollTo ) {
        scrollToElementWithId( options.scrollTo );
    }
}

function appendVoteGraphTo ( location, voteObjects ) {
    const WIDTH = 650, HEIGHT = 250, MARGIN = { top: 15, bottom: 35, left: 50, right: 0 };
    var xScale = d3.time.scale()
        .range( [ 0, WIDTH ] )
        .domain( d3.extent( voteObjects, function ( d ) { return d.time; } ) );

    var voteTotals = {};
    voteObjects.forEach( function ( voteObject ) {
        voteTotals[ voteObject.vote ] = 1 + voteTotals[ voteObject.vote ] || 0;
    } );
    var yScale = d3.scale.linear()
        .range( [ HEIGHT, 0 ] )
        .domain( [ 0, d3.max( $.map( voteTotals, function ( value ) { return value; } ) ) + 5 ] );

    var xAxis = d3.svg.axis()
        .scale( xScale )
        .orient( "bottom" );
    var yAxis = d3.svg.axis()
        .scale( yScale )
        .orient( "left" );
    var voteRunningTotals = {};
    var line = d3.svg.line()
        .x( function ( d ) { return xScale( d.time ); } )
        .y( function ( d ) {
            if ( !voteRunningTotals.hasOwnProperty( d.vote ) ) {
                voteRunningTotals[ d.vote ] = 0;
            }
            voteRunningTotals[ d.vote ] += 1;
            return yScale( voteRunningTotals[ d.vote ] );
        } );
    var svg = d3.select( location ).append( "svg" )
        .attr( "width", WIDTH + MARGIN.left + MARGIN.right)
        .attr( "height", HEIGHT + MARGIN.top + MARGIN.bottom);

    // We rotate the tick labels so they don't overlap
    // Source: http://stackoverflow.com/a/16863559/1757964
    svg.append( "g" ).call( xAxis )
        .attr( "class", "x axis" )
        .attr( "transform", "translate(0," + HEIGHT + ")" )
        .selectAll( "text" )
        .style("text-anchor", "end")
        .attr( "transform", "rotate(-35)" );

    svg.append( "g" ).call( yAxis )
        .attr( "class", "y axis" );
    for ( var voteType in voteTotals ) {
        var specificVotes = [];
        for ( var key in voteObjects ) {
            if ( voteObjects[ key ].vote === voteType ) {
                specificVotes.push( voteObjects[ key ] );
            }
        }
        svg.append( "path" )
            .datum( specificVotes )
            .attr( "d", line )
            .attr( "class", "line " + voteType.toLowerCase() )
            .attr( "vote-type", voteType );
        svg.append( "text" )
            .attr( "x", xScale( specificVotes.slice( -1 )[0].time ) )
            .attr( "y", yScale( voteTotals[ voteType ] ) )
            .text( voteType )
            .attr( "class", voteType.toLowerCase().substr( 0, 10 ) );
    }

    // Download link
    var allVoteTypes = Object.keys( voteTotals );
    var downloadData = [ [ "Time" ].concat( allVoteTypes ) ];
    var runningVoteTotals = {};
    var voteTotalsSnapshot = [];
    allVoteTypes.forEach( function ( voteType ) { runningVoteTotals[ voteType ] = 0; } );
    voteObjects.forEach( function ( voteObject ) {
        runningVoteTotals[ voteObject.vote ]++;
        voteTotalsSnapshot = allVoteTypes.map( function ( voteType ) { return runningVoteTotals[ voteType ]; } );
        downloadData.push( [ voteObject.time.format().replace( "+00:00", "" ) ].concat( voteTotalsSnapshot ) );
    } );
    $( location ).append( createDownloadDiv( downloadData ) );

    // Align download links
    $( "div.download" ).css( "width", $( "svg" ).first().outerWidth() );
}

/**
 * rfxType is a string: "rfa" if rfa, "rfb" if rfb, "" if none.
 * It's used to display the right color-coding.
 */
function appendSupportPercentageGraphTo ( location, voteObjects, rfxType ) {
    const WIDTH = 650, HEIGHT = 250, MARGIN = { top: 15, bottom: 35, left: 50, right: 0 };
    var i;
    var xScale = d3.time.scale()
        .range( [ 0, WIDTH ] )
        .domain( d3.extent( voteObjects, function ( d ) { return d.time; } ) );

    // Calculate the highest and lowest percentages reached, for the y-scale
    var runningSupports = 0,
        runningOpposes = 0;
    var percentages = [];
    var calcOpposePercentage = document.getElementById( "oppose-percentage" ).checked;
    var showFullScale = document.getElementById( "show-full-scale" ).checked;
    for(i = 0; i < voteObjects.length; i++) {
        if( voteObjects[i].vote === "Support" || voteObjects[i].vote === "Yes" ) runningSupports++;
        if( voteObjects[i].vote === "Oppose" || voteObjects[i].vote === "No" ) runningOpposes++;

        // Div by 0 check
        if( ( runningSupports + runningOpposes) > 0 ) {
            percentages.push( {
                "time": voteObjects[i].time,
                "percentage": ( calcOpposePercentage ? runningOpposes : runningSupports ) / ( runningSupports + runningOpposes )
            } );
        }
    }
    if( showFullScale ) {
        var yExtent = [0, 1];
    } else {
        var yExtent = d3.extent( percentages, function ( d ) { return d.percentage; } );
        if( yExtent[0] == yExtent[1] ) {

            // The graph will be a line, so expand y-axis
            if( yExtent[0] == 0 ) {

                // % is always 0 -> make range 0% to 1%
                yExtent[1] = 0.01;
            } else {

                // otherwise -> make range (x - 1)% to x%
                yExtent[0] = yExtent[1] - 0.01;
            }
        }
    }
    var yScale = d3.scale.linear()
        .range( [HEIGHT, 0] )
        .domain( yExtent );

    var xAxis = d3.svg.axis()
        .scale( xScale )
        .orient( "bottom" );
    var yAxis = d3.svg.axis()
        .tickFormat( function ( tickData ) { return d3.format( ".0%" )( tickData ); } )
        .scale( yScale )
        .orient( "left" );
    var line = d3.svg.line()
        .x( function ( d ) { return xScale( d.time ); } )
        .y( function ( d ) { return yScale( d.percentage ); } );
    var svg = d3.select( location ).append( "svg" )
        .attr( "class", "support" )
        .attr( "width", WIDTH + MARGIN.left + MARGIN.right)
        .attr( "height", HEIGHT + MARGIN.top + MARGIN.bottom);

    if( rfxType ) {
        // Show color coding in background

        // Background color
        var backgroundRectHeight = HEIGHT/( ( yExtent[1] - yExtent[0] ) * 100 );

        // yExtent contains percentages as decimals, but we want i
        // to take on percentages as ints (i.e. yExtent[0] = 0.01 -> i starts
        // at 1, meaning 1%) to match the color coding keys
        var endPercent = Math.floor( yExtent[1] * 100 ) + ( ( yExtent[0] === 0 && !showFullScale) ? 1 : 0 );
        var colorCodes = window.SUPPORT_PERCENTAGE_COLOR_CODES[rfxType];
        for( i = Math.floor( yExtent[0] * 100 ) + 1; i <= endPercent; i++ ) {
            var localY = yScale( i / 100 );
            if( localY >= HEIGHT + 1 ) {
                break;
            }
            var localHeight = Math.min( backgroundRectHeight, HEIGHT - localY );

            svg.append( "rect" )
                .attr( "class", "background" )
                .style( "fill", "#" + colorCodes[calcOpposePercentage ? ( 100 - i ) : i] )
                .attr( "x", 0 )
                .attr( "y", Math.max( 0, yScale( i/100 ) ) )
                .attr( "width", WIDTH )
                .attr( "height", localHeight );
        }
    }

    // Axes
    svg.append( "g" ).call( xAxis )
        .attr( "class", "x axis" )
        .attr( "transform", "translate(0," + HEIGHT + ")" )
        .selectAll( "text" )
        .style("text-anchor", "end")
        .attr( "transform", "rotate(-35)" );
    svg.append( "g" ).call( yAxis )
        .attr( "class", "y axis" );

    // The data line
    svg.append( "path" )
        .datum( percentages )
        .attr( "d", line )
        .attr( "class", "line percentage" );

    // Tooltip
    var tooltip = svg.append( "g" ).style( "display", "none" );

    tooltip.append( "circle" )
        .style( "fill", "none" )
        .style( "stroke", "blue" )
        .attr( "r", 4 );

    tooltip.append( "text" )
        .attr( "class", "time" )
        .attr( "dy", -27 )
        .style( "stroke", "black" )
        .style( "stroke-width", "0.1px" );

    tooltip.append( "text" )
        .attr( "class", "percentage" )
        .attr( "dy", -10 )
        .style( "stroke", "none" );

    // Element to capture mouse events
    var mouseEventSinkId = "vh-mouse-event-sink";
    svg.append( "rect" )
        .attr( "id", mouseEventSinkId )
        .attr( "width", WIDTH )
        .attr( "height", HEIGHT )
        .attr( "fill", "none" )
        .style( "pointer-events", "all" )
        .on( "mouseover", function () { tooltip.style( "display", null ); } )
        .on( "mouseout", function () { tooltip.style( "display", "none" ); } );

    document.getElementById( mouseEventSinkId ).addEventListener( "mousemove", function ( event ) {
        var eventTime = xScale.invert( event.clientX - $( "#" + mouseEventSinkId ).offset().left );
        var targetIndex = d3.bisector( function ( d ) { return d.time; } ).left( percentages, eventTime, 1 );
        var leftDatapoint = percentages[ targetIndex - 1 ];
        var rightDatapoint = percentages[ targetIndex ];
        var datapoint = eventTime - leftDatapoint.time > rightDatapoint.time - eventTime ? rightDatapoint : leftDatapoint;
        var transform = "translate(" + xScale( datapoint.time ) + ", " + yScale( datapoint.percentage ) + ")";
        tooltip.select( "circle" ).attr( "transform", transform );
        tooltip.select( "text.time" )
            .attr( "transform", transform )
            .text( datapoint.time.format( "HH:mm, D MMM YYYY" ) );
        tooltip.select( "text.percentage" )
                .attr( "transform", transform )
            .text( d3.format( ".1%" )( datapoint.percentage ) );
    } );

    // Download link
    var downloadData = [ [ "Time", "Percentage" ] ];
    percentages.forEach( function ( dataPoint ) {
        downloadData.push( [ dataPoint.time.format().replace( "+00:00", "" ), dataPoint.percentage ] );
    } );
    $( location ).append( createDownloadDiv( downloadData ) );

    // Align download links
    $( "div.download" ).css( "width", $( "svg" ).first().outerWidth() );
}

function createDownloadDiv( data ) {

    // Build file
    var fileText = "";
    data.forEach( function ( record ) {
        fileText += record.join( "," ) + "\n";
    } );
    fileText = fileText.trim();

    var textArea = $( "<textarea>" )
        .hide()
        .text( fileText )
        .attr( "readonly", "readonly" )
        .click( function () { this.select(); } );

    // Make link
    return $( "<div>" )
        .addClass( "download" )
        .append( $( "<p>" )
                 .append( $( "<a>" )
                          .attr( "href", "#" )
                          .text( "View" )
                          .click( function () {

                              // If the text area isn't in the DOM yet, make it so
                              if( !textArea.parent().length ) {
                                  $( this ).parent().parent().append( textArea );
                              }

                              textArea.toggle();
                              $( this ).text( ( $( this ).text() === "View" ) ? "Hide" : "View" );
                              return false;
                          } ) )
                 .append( " the data for this graph." ) );
}

function scrollToElementWithId( id ) {
    if( id.startsWith( "#" ) ) id = id.replace( "#", "" );
    if( document.getElementById( id ) ) {
        window.scrollTo( 0, $( "#" + id ).offset().top );
    }
}

// From http://stackoverflow.com/a/6969486/1757964
function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

// Export some functions for testing
if( typeof module === typeof {} ) {
    module.exports = {
        "getPageText": getPageText,
        "analyzeDiscussion": analyzeDiscussion
    };
}
