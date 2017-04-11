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

function testRfaXSupports( x, voteText ) {
    voteText = VoteHistorySpecialCases.getFunction( "Wikipedia:Requests for adminship/Example" )( voteText );
    var analysis = analyzeDiscussion( voteText, "Wikipedia:Requests for adminship" );
    expect( analysis.voteTally[ "Support" ] ).to.equal( x );
}

describe( "The parser", function () {
    it( "should parse single votes", function () {
        [ "Support", "Oppose", "Neutral" ].forEach( function ( voteType ) {
            expect( analyzeDiscussion( "*'''" + voteType + "''' per nom. [[User:Example|Example]] ([[User talk:Example|talk]]) 22:04, 12 January 2017 (UTC)", "" ).voteTally ).to.have.property( voteType, 1 );
        } );
    } );

    describe( "should parse the corner case of", function () {

        it( "(UTC))", function () {
            expect( analyzeDiscussion( "#'''Support''' [[User:X|X]] ([[User talk:X|talk]]) 00:00, 1 January 2000 (UTC))\n#'''Support''' [[User:Y|Y]] ([[User talk:Y|talk]]) 00:00, 1 January 2000 (UTC)", "Wikipedia:Requests for adminship/Example" ).voteTally[ "Support" ] ).to.equal( 2 );
        } );

        it( "(UTC).</small><br />", function () {
            testRfaXSupports( 3, "#'''Support''' [[User:X|X]] ([[User talk:X|talk]]) 00:01, 1 January 2000 (UTC)\n#'''Support''' [[User:Y|Y]] ([[User talk:Y|talk]]) 00:00, 1 January 2000 (UTC).</small><br />\n#'''Support''' [[User:Z|Z]] ([[User talk:Z|talk]]) 00:01, 1 January 2000 (UTC)", "Wikipedia:Requests for adminship/Example" );
        } );

        it( "an embedded timestamp", function () {
            var analysis = analyzeDiscussion( "#'''Oppose''': Lorem ipsum dolor sit amet<!--\n--><p>foo bar The article was created at 17:17, 1 January 2000 (UTC). foo bar</p><!--\n--><p>[[User:X|X]] ([[User talk:X|talk]]) 00:01, 1 January 2000 (UTC)", "Wikipedia:Requests for adminship/Example" );
            expect( analysis.voteTally ).to.have.property( "Oppose", 1 );
            expect( analysis.voteObjects[ 0 ].time.toISOString() ).to.equal( "2000-01-01T00:01:00.000Z" );
        } );
    } );

    it( "detects duplicate votes", function () {
        testRfaXSupports( 1, "#'''Support''' [[User:X|X]] ([[User talk:X|talk]]) 00:00, 1 January 2000 (UTC)\n#'''Support''' [[User:X|X]] ([[User talk:X|talk]]) 00:01, 1 January 2000 (UTC)" );
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
                //if(shortPageTitle == "Danny 2"){var i = 0;analysis.voteObjects.forEach(function(v){if(v.vote=="Oppose")console.log(++i + ". " + v.vote + " on " + v.time.format("HH:mm, DD MMMM YYYY") + " by " + v.user );});}
                var voteTally = analysis.voteTally;
                if( voteTally[ "Comment" ] ) delete voteTally[ "Comment" ];
                expect( voteTally ).to.eql( actualVoteTally );
            } );
        } );
    } );
} );
