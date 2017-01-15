/* jshint moz: true */
/* global VoteHistorySpecialCases, moment */
const API_ROOT = "https://en.wikipedia.org/w/api.php",
      API_OPTIONS = "action=query&prop=revisions&rvprop=content&format=jsonfm",
      API_SUFFIX = "&format=json&callback=?&continue=";

function getPageText( pageTitle ) {
    var apiUrl = API_ROOT + "?" + API_OPTIONS + "&titles=" + pageTitle + API_SUFFIX;
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
        return;
    }

    $( "#discussions" ).show();
    $( "#discussions" ).text( "Loading..." );

    // Preprocess title

    // Replace aliases ([[WP:ALIAS]])
    pageTitle = pageTitle
        .replace( /^(WP|Project):/, "Wikipedia:" )
        .replace( /^(WT|Project talk):/, "Wikipedia talk:" );

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
                                        .append( $( "<a> " )
                                                 .attr( "href", "https://en.wikipedia.org/wiki/" + pageTitle )
                                                 .text( pageTitle ) )
                                        .append( "." ) );
            var discussionAnalysis = analyzeDiscussion( VoteHistorySpecialCases.getFunction( pageTitle )( pageText ),
                                                        pageTitle );
            displayDiscussionAnalysis( discussionAnalysis,
                                       {
                                           "showSupportPercentageGraph": pageTitle.startsWith( "Wikipedia:Requests for adminship/" ),
                                           "scrollTo": window.location.hash
                                       } );
        } else if ( !sectionHeaders ) {
            if ( getVotes( pageText ) || pageText.match( /\*/ ) ) {
                $( "#discussions" ).append( $( "<div>" )
                                            .addClass( "successbox" )
                                            .append( "Single-discussion page detected at " )
                                            .append( $( "<a> " )
                                                     .attr( "href", "https://en.wikipedia.org/wiki/" + pageTitle )
                                                     .text( pageTitle ) )
                                            .append( "." ) );
                displayDiscussionAnalysis( analyzeDiscussion( section, pageTitle ), { "scrollTo": window.location.hash } );
            } else {
                $( "#discussions" ).hide();
                $( "#error" ).empty().show();
                $( "#error" ).append( $( "<div>" )
                                      .addClass( "errorbox" )
                                      .append( "I couldn't find any discussion headers on " )
                                      .append( $( "<a> " )
                                               .attr( "href", "https://en.wikipedia.org/wiki/" + pageTitle )
                                               .text( "the page" ) )
                                      .append( "." ) );
            }
        } else {
            $( "#discussions" ).append( $( "<h2>" ).text( "Discussions on " )
                                        .append( $( "<a> " )
                                                 .attr( "href", "https://en.wikipedia.org/wiki/" + pageTitle )
                                                 .text( pageTitle ) ) );
            sectionHeaders.forEach( function ( item, index ) {
                var trailerRegex = ( index == sectionHeaders.length - 1 ) ? "" : "?==",
                    regex = item + "\n(\n|.)*" + trailerRegex;
                var section = pageText.match( new RegExp( regex, "g" ) );
                if ( !section ) return;
                section = section[0];

                var votes = getVoteMatches( section );
                var disabledAttr = votes ? {} : { "disabled": "disabled" };
                var analyzeHandler = function () {
                    displayDiscussionAnalysis( analyzeDiscussion( section, pageTitle ), { "scrollTo": "analysis" } );
                };
                $( "#discussions" ).append( $( "<div>" )
                                            .addClass( "discussion" )
                                            .append( $( "<button>" )
                                                     .addClass( "mw-ui-button mw-ui-progressive" )
                                                     .addClass( "vote-history-analyze-button" )
                                                     .text( "Analyze >>" )
                                                     .attr( disabledAttr )
                                                     .click( analyzeHandler ) )
                                            .append( $( "<b>" ).text( item.replace( /=/g, "" ) ) )
                                            .append( $( "<i>" ).text( ( !votes ? "No votes" : ( votes.length + " votes" ) ) +
                                                                      "; " + section.length + " bytes" ) ) );
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

function getVoteMatches ( voteText ) {
    voteText = voteText.replace( /=.+?=/, "" );
    var matches = voteText.match( /^[#\*]\s*'''.+?'''[\s\S]*?\d\d:\d\d,\s\d{1,2}\s\w+?\s\d\d\d\d\s\(UTC\).*$/mg );
    return matches;
}

function analyzeDiscussion ( discussionText, pageTitle ) {
    var voteMatches = getVoteMatches( discussionText );
    if ( !voteMatches ) {
        return {};
    }

    var voteObjects = [];
    voteMatches.forEach( function ( voteText ) {
        var vote = voteText.match( /'''(.+?)'''/ )[1],
            timestamp = voteText.match( /(\d\d:\d\d,\s\d{1,2}\s\w+\s\d\d\d\d)\s\(UTC\)(?!.*\(UTC\).*)/ )[1];
        vote = vote
            .replace( /Obvious/i, "" )
            .replace( /Speedy/i, "" )
            .replace( /Strong/i, "" )
            .trim();

        // Votes that contain the string "support" (or "oppose", etc)
        // are treated as if they consisted entirely of "support" (etc)
        [ "support", "oppose", "neutral", "keep", "delete" ].forEach( function ( voteType ) {
            if ( vote.toLowerCase().indexOf( voteType ) > -1 ) {
                vote = voteType.charAt( 0 ).toUpperCase() + voteType.substring( 1 );
            }
        } );

        // All other votes are transformed from xXxXx (or whatever) to Xxxxx
        vote = vote.charAt( 0 ).toUpperCase() + vote.substr( 1 ).toLowerCase();
        var voteObject = { "vote": vote, "time": moment( timestamp, "HH:mm, DD MMM YYYY" ) };
        voteObjects.push( voteObject );
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

    // Zero out allowed votes that aren't in the tally yet
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
        "voteTypes": voteTypes
    };
}

/*
 * Options:
 *  - showSupportPercentageGraph (boolean) - true if the "support percentage graph" should be shown
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
        $( "#analysis" ).append( "<section id='support-percentage-graph'><h2>Support percentage graph</h2></section>" );
        appendSupportPercentageGraphTo( "#support-percentage-graph", discussionAnalysis.filteredVoteObjects );
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

    $( "#analysis" ).append( "<section id='vote-list'><h2>Vote list</h2></section>" );

    // Show a note if we filtered any votes
    var numVotesFiltered = discussionAnalysis.voteObjects.length -
        discussionAnalysis.filteredVoteObjects.length;
    if( numVotesFiltered > 0 ) {
        $( "#vote-list" ).append("<p><i>Including " + numVotesFiltered + " singleton vote" +
                                 ( numVotesFiltered === 1 ? "" : "s" ) + " that " +
                                 ( numVotesFiltered === 1 ? "isn't" : "aren't" ) + " shown in the graph and table.</i></p>");
    }

    $( "#vote-list" ).append( $( "<ul>" ) );
    discussionAnalysis.voteObjects.forEach( function ( voteObject ) {
        $( "#vote-list ul" ).append( $( "<li>" ).text( voteObject.vote + ", cast on " +
                                                       voteObject.time.format( "HH:mm, D MMMM YYYY" ) ) );
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
}

function appendSupportPercentageGraphTo ( location, voteObjects ) {
    const WIDTH = 650, HEIGHT = 250, MARGIN = { top: 15, bottom: 35, left: 50, right: 0 };
    var i;
    var xScale = d3.time.scale()
        .range( [ 0, WIDTH ] )
        .domain( d3.extent( voteObjects, function ( d ) { return d.time; } ) );

    // Calculate the highest and lowest percentages reached, for the y-scale
    var runningSupports = 0,
        runningOpposes = 0;
    var percentages = [];
    for(i = 0; i < voteObjects.length; i++) {
        if( voteObjects[i].vote === "Support" ) runningSupports++;
        if( voteObjects[i].vote === "Oppose" ) runningOpposes++;
        percentages.push( {
            "time": voteObjects[i].time,
            "percentage": runningSupports / ( runningSupports + runningOpposes )
        } );
    }
    var yExtent = d3.extent( percentages, function ( d ) { return d.percentage; } );
    if( yExtent[ 0 ] == yExtent [ 1 ] ) {

        // The graph will be a line, so expand y-axis
        if( yExtent[ 0 ] == 0 ) {

            // % is always 0 -> make range 0% to 1%
            yExtent[ 1 ] = 0.01;
        } else {

            // otherwise -> make range (x - 1)% to x%
            yExtent[ 0 ] = yExtent[ 1 ] - 0.01;
        }
    }
    var yScale = d3.scale.linear()
        .range( [ HEIGHT, 0 ] )
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

    // Background color
    var backgroundRectHeight = HEIGHT/( ( yExtent[1] - yExtent[0] ) * 100 );

    // yExtent contains percentages as decimals, but we want i
    // to take on percentages as ints (i.e. yExtent[0] = 0.01 -> i starts
    // at 1, meaning 1%) to match the color coding keys
    for( i = Math.floor( yExtent[0] * 100 ) + 1; i <= Math.floor( yExtent[1] * 100 ); i++ ) {
        var localY = yScale( i / 100 );
        if( localY >= HEIGHT ) {
            break;
        }
        var localHeight = Math.min( backgroundRectHeight, HEIGHT - localY );

        svg.append( "rect" )
            .attr( "class", "background" )
            .style( "fill", "#" + window.SUPPORT_PERCENTAGE_COLOR_CODES[i] )
            .attr( "x", 0 )
            .attr( "y", yScale( i/100 ) )
            .attr( "width", WIDTH )
            .attr( "height", localHeight );
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
}

function scrollToElementWithId( id ) {
    if( id.startsWith( "#" ) ) id = id.replace( "#", "" );
    if( document.getElementById( id ) ) {
        window.scrollTo( 0, $( "#" + id ).offset().top );
    }
}

// Export some functions for testing
module.exports = {
    "getPageText": getPageText,
    "analyzeDiscussion": analyzeDiscussion
};
