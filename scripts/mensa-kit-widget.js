/**************************************************************************
*                                                                         *
*  Scriptable script to create a medium sized widget                      *
*  which intelligently displays the menu of Mensa Am Adenauerring at KIT  *
*                                                                         *
**************************************************************************/

//set up text and background colors
let textColor = new Color("#000000");
let backgroundColor = new Color("#ffffff");

widget = await createWidget()

if (config.runsInWidget) {
  // The script runs inside a widget, so we pass our instance of ListWidget to be shown inside the widget on the Home Screen.
  Script.setWidget(widget)
} else {
  // The script runs inside the app, so the widget get previewed.
  widget.presentMedium()
}
// Calling Script.complete() signals to Scriptable that the script have finished running.
// This can speed up the execution, in particular when running the script from Shortcuts or using Siri.
Script.complete()


/*********************************************
*                                            *
*  function which creates the widget object  *
*                                            *
*********************************************/
async function createWidget() {

    /*********************************
    *                                *
    *  setup widget and displayDate  *
    *                                *
    *********************************/

    let widget = new ListWidget()
    widget.setPadding(2,4,2,4)

    // set url to open on tap to mensa meal menu
    widget.url = "https://www.sw-ka.de/de/hochschulgastronomie/speiseplan/mensa_adenauerring/"

    //set widget background
    widget.backgroundColor = backgroundColor

    //calculate the displayed date. Use current day unless it's after 14:00, then display the next day's menu.
    //If it's weekend or friday afternoon, show Monday's menu
    const currentDate = new Date();

    let displayedDate = new Date(currentDate);
    if(currentDate.getDay() === 6 || currentDate.getDay() === 0 || (currentDate.getDay() === 5 && currentDate.getHours() >= 14)){
        //set displayedDate to next monday if currentDate is saturday, sunday or friday after 14:00
        displayedDate.setDate(currentDate.getDate() + (1 + 7 - currentDate.getDay()) % 7)
    } else if (currentDate.getHours() >= 14){
        //else check if it's after 14:00, if so set displayed date to next day
        displayedDate.setDate(displayedDate.getDate() + 1);
    }

    /*********************
    *                    *
    *  Title and Widget  *
    *                    *
    *********************/

    //array to map weekday names
    const weekdayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

    //construct title with weekday name and date
    let title = `Speiseplan: ${weekdayNames[displayedDate.getDay()]}, ${displayedDate.toLocaleDateString()}`


    // Show StudierendenWerk icon and title
    let titleStack = widget.addStack()
    titleStack.addSpacer() // add space in front of logo

    let swIcon = await loadSWIcon()
    let swIconElement = titleStack.addImage(swIcon)
    swIconElement.imageSize = new Size(15, 15)
    swIconElement.cornerRadius = 4

    titleStack.addSpacer(4) //space between logo and title

    let titleElement = titleStack.addText(title)
    titleElement.textColor = textColor
    titleElement.font = Font.boldSystemFont(13)

    titleStack.addSpacer();

    /*****************
    *                *
    *  Menu content  *
    *                *
    *****************/

    //get closed state of mensa
    const {closed} = await loadClosedState(displayedDate)

    let contentStack = widget.addStack();
    contentStack.layoutVertically();

    if(closed){
        //if mensa is closed show "Geschlossen" in Red
        contentStack.centerAlignContent();
        contentStack.addSpacer(12)
        let closedElement = contentStack.addText("Geschlossen")
        closedElement.textColor = Color.red()
        closedElement.font = Font.boldSystemFont(30)
    } else {
        //if Mensa is open, show meals
        //get mealMenu
        const mealMenu = await loadMealMenu(displayedDate);

        // go over each line and render meals offered there
        mealMenu.forEach(line => {
            contentStack.addSpacer(2);

            //add new lineStack (horizontal layout)
            let lineStack = contentStack.addStack();

            //add lineNumber
            let lineNumber = lineStack.addText(`${line.displayName}:`)
            lineNumber.textColor = textColor
            lineNumber.font = Font.boldSystemFont(10);

            //add space between number and meals
            lineStack.addSpacer(4)

            //add mealStack (vertical layout)
            let mealStack = lineStack.addStack();
            mealStack.layoutVertically();

            //add meals
            line.meals.forEach(meal => {
                let mealEntry = mealStack.addText(meal.name)
                mealEntry.minimumScaleFactor = 0.5
                mealEntry.textColor = textColor
                mealEntry.font = Font.systemFont(10)
            })
        })
    }

    return widget
}

/*********************
*                    *
*  Helper Functions  *
*                    *
*********************/

//function to get StudierendenWerk favicon to display in widget title
async function loadSWIcon() {
  let url = "https://www.sw-ka.de/favicon.ico"
  let req = new Request(url)
  return req.loadImage()
}

//function to get opening state of Mensa
async function loadClosedState(displayedDate) {
  const closedReq = new Request(getOpenMensaBaseURL(displayedDate));
  return await closedReq.loadJSON();
}

//function to get mealMenu from API and filter it before returning
async function loadMealMenu(displayedDate){
  const mealMenuReq = new Request(`${getOpenMensaBaseURL(displayedDate)}/meals`)
  return filterMealMenu(await mealMenuReq.loadJSON())
}

//function the construct the openMensa API base URL for Mensa Am Adenauerring with displayed date
function getOpenMensaBaseURL(displayedDate){
    //ID of Mensa for OpenMensa API
    const mensaId = 1719;
    //get displayDate in correct format for API
    const date = `${displayedDate.getFullYear()}-${displayedDate.getMonth()+1}-${displayedDate.getDate()}`;
    return `https://openmensa.org/api/v2/canteens/${mensaId}/days/${date}`;
}

async function filterMealMenu(mealMenu) {
    //lines to include in filtered menu
    const linesToFilterFor = [
        "Linie 1",
        "Linie 2",
        "Linie 3",
        "Linie 4",
        "Linie 5",
        "Pizza"
    ]

    //meals to exclude (needs to be only partly matched)
    const excludedMeals = ["Insalata", "Margherita", "Tagesdessert", "Blattsalat", "Tagessuppe"]

    //Display names for each line that is included in the final menu.
    //Display names need to be different from actual names because actual names are too long and extensive to display them in a widget
    // noinspection JSNonASCIINames
    const displayNames = {
        "Linie 1 Gut & Günstig": "1",
        "Linie 2 Vegane Linie": "2",
        "Linie 3": "3",
        "Linie 4": "4",
        "Linie 5": "5",
        "[pizza]werk Pizza 11-14 Uhr": "Pizza"
    }


    //initilize array for grouped menu
    let lines = []

    //go over whole mealMenu to filter out unwanted lines and meals, touchup some unwanted data and group meals by line in "lines" array
    mealMenu.forEach(meal => {

        if(linesToFilterFor.some(line => meal.category.includes(line))) {
            //remove 'Aktion "x"' parts
            if(meal.name.startsWith("Aktion")) {
                meal.name = /".*" (.+)/.exec(meal.name)[1];
            }

            //check if line already exists in lines array, if not, create object with name and displayName
            if(!lines.some(line => line.name === meal.category)){
                lines.push({name: meal.category, displayName: displayNames[meal.category], meals: []})
            }

            //sometimes meal options are represented in notes of line 3, 4 or 5 (mostly if there is not price set). If so, extract note and add as new meal (only if note hasn't already been converted)
            if((meal.category.includes("Linie 3") || meal.category.includes("Linie 4") || meal.category.includes("Linie 5")) && meal.notes && meal.notes.length > 0 && !(lines[lines.findIndex(line => line.name === meal.category)].meals.some(meal2 => meal.notes[0] === meal2.name)) ){

                lines[lines.findIndex(line => line.name === meal.category)].meals.push({
                    category: meal.category,
                    name: meal.notes[0],
                    notes: []
                })

            }
            if(!(excludedMeals.some(excludedMeal => meal.name.includes(excludedMeal)))){
                lines[lines.findIndex(line => line.name === meal.category)].meals.push(meal)
            }
        }
    });

    return lines
}
