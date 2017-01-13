var expect = require( "must" );
var rewire = require( "rewire" );
var votehistory = rewire( "../js/votehistory.js" );
var VoteHistorySpecialCases = require( "../js/special-cases.js" );
var fs = require( "fs" );
var path = require( "path" );

// votehistory wants moment in the browser, so monkeypatch it in
votehistory.__set__( "moment", require( "moment" ) );

var getPageText = votehistory.getPageText;
var analyzeDiscussion = votehistory.analyzeDiscussion;

describe( "The parser", function () {
    it( "should parse single votes", function () {
        [ "Support", "Oppose", "Neutral" ].forEach( function ( voteType ) {
            expect( analyzeDiscussion( "*'''" + voteType + "''' per nom. [[User:Example|Example]] ([[User talk:Example|talk]]) 22:04, 12 January 2017 (UTC)", "" ).voteTally ).to.have.property( voteType, 1 );
        } );
    } );

    describe( "should parse the corner case of", function () {
        function testRfaXSupports( x, voteText ) {
            voteText = VoteHistorySpecialCases.getFunction( "Wikipedia:Requests for adminship/Example" )( voteText );
            var analysis = analyzeDiscussion( voteText, "Wikipedia:Requests for adminship" );
            expect( analysis.voteTally[ "Support" ] ).to.equal( x );
        }

        it( "(UTC))", function () {
            expect( analyzeDiscussion( "#'''Support''' [[User:X|X]] ([[User talk:X|talk]]) 00:00, 1 January 2000 (UTC))\n#'''Support''' [[User:Y|Y]] ([[User talk:Y|talk]]) 00:00, 1 January 2000 (UTC)", "Wikipedia:Requests for adminship/Example" ).voteTally[ "Support" ]).to.equal( 2 );
        } );
    } );

    describe( "should parse", function () {
        fs.readdirSync( path.join( __dirname, "data" ) ).forEach( function ( filename ) {
            var rfaText = fs.readFileSync( path.join( __dirname, "data", filename ), { "encoding": "utf-8" } );
            var voteTallyMatch = filename.match( /\((\d+)\s(\d+)\s(\d+)\)/ );
            var actualVoteTally = { "Support": parseInt( voteTallyMatch[ 1 ] ),
                                    "Oppose": parseInt( voteTallyMatch[ 2 ] ),
                                    "Neutral": parseInt( voteTallyMatch[ 3 ] ) };
            var shortPageTitle = filename.replace( /\s\(\d+\s\d+\s\d+\)\.txt/, "" );

            it( "WP:RFA/" + shortPageTitle, function () {
                var pageTitle = "Wikipedia:Requests for adminship/" + shortPageTitle;
                var analysis = analyzeDiscussion( VoteHistorySpecialCases.getFunction( pageTitle )( rfaText ), pageTitle );
                //if(shortPageTitle == "K6ka"){var i = 0;analysis.voteObjects.forEach(function(v){if(v.vote=="Support")console.log(++i + ". " + v.vote + " on " + v.time.format("HH:mm, DD MMMM YYYY"));});}
                var voteTally = analysis.voteTally;
                if( voteTally[ "Comment" ] ) delete voteTally[ "Comment" ];
                expect( voteTally ).to.eql( actualVoteTally );
            } );
        } );
    } );
} );
