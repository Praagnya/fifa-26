import asyncio
import json
import hashlib
import os
from playwright.async_api import async_playwright
import openai
from dotenv import load_dotenv

load_dotenv()

JS_EXTRACT_ELEMENTS = """
() => {
    let elements = [];
    let id_counter = 1;
    const selectors = ['a', 'button', 'input', '[role="button"]'];
    document.querySelectorAll(selectors.join(', ')).forEach(el => {
        // Skip invisible elements
        if (el.offsetWidth === 0 || el.offsetHeight === 0) return;
        const tagName = el.tagName.toLowerCase();
        let text = el.innerText || el.value || el.getAttribute('aria-label') || el.name || '';
        text = text.trim().replace(/\\s+/g, ' ');
        if (!text) return; // Skip empty elements
        
        const elem_id = `elem-${id_counter}`;
        el.setAttribute('data-crawler-id', elem_id);
        elements.push({
            id: elem_id,
            tag: tagName,
            text: text
        });
        id_counter++;
    });
    return elements;
}
"""

class BrowserController:
    """Wraps Playwright for extracting context and executing actions"""
    def __init__(self):
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None

    async def start(self):
        self.playwright = await async_playwright().start()
        # Headless=False so the interviewers can see it working!
        self.browser = await self.playwright.chromium.launch(headless=False)
        self.context = await self.browser.new_context()
        self.page = await self.context.new_page()

    async def navigate(self, url):
        print(f"Navigating to {url}...")
        await self.page.goto(url)
        await self.page.wait_for_load_state("networkidle")

    async def extract_context(self):
        url = self.page.url
        title = await self.page.title()
        elements = await self.page.evaluate(JS_EXTRACT_ELEMENTS)
        return {"url": url, "title": title, "elements": elements}

    async def take_screenshot(self, path):
        await self.page.screenshot(path=path)

    async def execute_action(self, element_id):
        try:
            locator = self.page.locator(f"[data-crawler-id='{element_id}']")
            await locator.click(timeout=5000)
            await self.page.wait_for_load_state("networkidle")
            return True
        except Exception as e:
            print(f"⚠️ Failed to click {element_id}: {e}")
            return False

    async def stop(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()


class StateTracker:
    """Maintains the directed graph and computes state identity"""
    def __init__(self):
        self.nodes = []
        self.edges = []
        self.visited_fingerprints = set()
        self.state_counter = 1

    def compute_fingerprint(self, elements):
        fingerprint_str = "|".join([f"{e['tag']}:{e['text']}" for e in elements])
        return hashlib.sha256(fingerprint_str.encode('utf-8')).hexdigest()[:10]

    def record_state(self, url, title, elements, screenshot_path):
        fingerprint = self.compute_fingerprint(elements)

        if fingerprint not in self.visited_fingerprints:
            self.visited_fingerprints.add(fingerprint)
            # Create a clean sequential ID (e.g., state_1, state_2)
            state_id = f"state_{str(self.state_counter).zfill(3)}"
            self.state_counter += 1
            
            node = {
                "id": state_id,
                "url": url,
                "title": title,
                "dom_fingerprint": fingerprint,
                "interactive_elements": [e['id'] for e in elements],
                "screenshot": screenshot_path
            }
            self.nodes.append(node)
            return state_id, True
        else:
            # Find the existing node ID
            for n in self.nodes:
                if n["dom_fingerprint"] == fingerprint:
                    return n["id"], False
                    
        return None, False

    def record_edge(self, from_state, to_state, action):
        self.edges.append({
            "from": from_state,
            "to": to_state,
            "action": action
        })
        
    def get_actions_for_state(self, state_id):
        """Return history of actions taken *from* this state to prevent loops"""
        return [edge["action"] for edge in self.edges if edge["from"] == state_id]

    def get_graph(self):
        return {"nodes": self.nodes, "edges": self.edges}


class LLMAgent:
    """Prompts OpenAI with current state context to decide the next action"""
    def __init__(self):
        self.client = openai.AsyncOpenAI()

    async def decide_action(self, state_url, elements, previous_actions_from_state):
        prompt = """
        You are an autonomous web crawler. You are currently on: {state_url}
        
        Visible interactive elements:
        {elements}
        
        Previous actions you have taken from this exact state:
        {actions}
        
        Your Goal: Select ONE element ID to click to explore a new flow.
        - Prefer un-explored navigation links or buttons.
        - Do NOT select an element if you see it in "Previous actions".
        - Do NOT click destructive elements (Delete, Logout).
        
        Return JSON matching this schema exactly:
        {{
            "type": "click",
            "target": "elem-X", 
            "description": "Why you chose this"
        }}
        If exploration is fully complete from this state, return "target": null.
        """
        
        formatted_prompt = prompt.format(
            state_url=state_url,
            elements=json.dumps(elements, indent=2),
            actions=json.dumps(previous_actions_from_state, indent=2)
        )
        
        response = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": formatted_prompt}],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        return json.loads(response.choices[0].message.content)


async def main_loop():
    """Builds the graph using Observe -> Identify -> Decide -> Act loop"""
    
    # We use a dummy test-app as requested
    target_url = "https://practicetestautomation.com/practice-test-login/"
    os.makedirs("screenshots", exist_ok=True)
    
    # Initialize Core Components
    browser_ctrl = BrowserController()
    tracker = StateTracker()
    agent = LLMAgent()
    
    await browser_ctrl.start()
    await browser_ctrl.navigate(target_url)
    
    current_state_id = None
    pending_edge = None
    max_steps = 5 # Limit for prototyping
    
    for step in range(max_steps):
        print(f"\n--- Output Loop {step + 1} ---")
        await asyncio.sleep(2)  # Wait for JS animations
        
        # 1. Observe
        context = await browser_ctrl.extract_context()
        
        # 2. Identify State
        state_id, is_new = tracker.record_state(
            url=context["url"],
            title=context["title"],
            elements=context["elements"],
            screenshot_path=f"screenshots/temp.png" # temporary
        )
        
        if is_new:
            screenshot_path = f"screenshots/{state_id}.png"
            await browser_ctrl.take_screenshot(screenshot_path)
            tracker.nodes[-1]["screenshot"] = screenshot_path # update with real path
            print(f"🌟 Discovered NEW State: {state_id}")
        else:
            print(f"🔄 Arrived at KNOWN State: {state_id}")
            
        # Complete the previous edge if we just transitioned!
        if pending_edge:
            pending_edge["to"] = state_id
            tracker.edges.append(pending_edge)
            pending_edge = None
            
        # 3. Decide Action
        actions_taken_here = tracker.get_actions_for_state(state_id)
        decision = await agent.decide_action(context["url"], context["elements"], actions_taken_here)
        
        target_id = decision.get("target")
        print(f"🧠 LLM Decision: {decision.get('description')} (Target: {target_id})")
        
        if not target_id:
            print("Exploration finished by LLM. Halting.")
            break
            
        # Prepare the next edge (we don't know the destination node until the NEXT loop!)
        pending_edge = {
            "from": state_id,
            "to": None,
            "action": decision
        }
        
        # 4. Act
        await browser_ctrl.execute_action(target_id)
        
    print("\n=== FINAL GRAPH ===")
    with open("graph_output.json", "w") as f:
        json.dump(tracker.get_graph(), f, indent=2)
    print("✅ Graph dumped to graph_output.json")
    
    await browser_ctrl.stop()

if __name__ == "__main__":
    asyncio.run(main_loop())
